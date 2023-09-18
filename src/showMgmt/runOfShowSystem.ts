import { Logger, LoggerFactory } from '../logging/logging';
import { ShowManager } from './manageShow';
import { ShowMatchRangeResult } from './types';
import { engine } from '@dcl/sdk/ecs'

export let adminList = ["0x7a3891acf4f3b810992c4c6388f2e37357d7d3ab", "0xaabe0ecfaf9e028d63cf7ea7e772cf52d662691a", "0xd210dc1dd26751503cbf1b8c9154224707820da8"]

export class RunOfShowSystem {
  static instances: RunOfShowSystem[] = []

  showMgr: ShowManager
  logger: Logger

  intermissionStarted = false
  countdownStarted = false
  lastShowIdx = 0

  timeLapse = 0
  checkIntervalSeconds = .1

  active: boolean = true
  enabled: boolean = true

  lastShowMatch: ShowMatchRangeResult = {} //cache to avoid creating new objects over and over 

  constructor(showMgr: ShowManager) {
    this.showMgr = showMgr
    this.logger = LoggerFactory.getLogger("RunOfShowSystem")

    if(RunOfShowSystem.instances.length < 1) {
      engine.addSystem(RunOfShowSystem.update)
    }
    RunOfShowSystem.instances.push(this)
  }
  reset() {
    this.lastShowIdx = 0
    this.timeLapse = 0
  }
  pause() {
    this.enabled = false
  }
  play() {
    this.enabled = true
  }
  update(dt: number) {
    if (!this.enabled) return

    this.timeLapse += dt

    if (this.timeLapse < this.checkIntervalSeconds) {
      return
    }
    this.timeLapse -= this.checkIntervalSeconds
    
    //FIND NEAREST SHOW THAT HAS NOT STARTED
    //FIND SHOW THAT STARTED
    //IF NO SHOWS NOT STARTED, END
    //IF NEAREST NOT ST
    //

    const date = new Date()

    const showMatch = this.lastShowMatch = this.showMgr.showSchedule.findShowToPlayByDateInPlace(this.lastShowMatch, date, this.lastShowIdx)

    if (showMatch && showMatch.lastShow && showMatch.lastShow.show) {
      //update index for faster checking
      this.lastShowIdx = showMatch.lastShow.index
    }

    this.processShow(showMatch)
  }
  processShow(showMatch: ShowMatchRangeResult) {
    const METHOD_NAME = "processShow"
    if (!showMatch) {
      return
    }
    if (showMatch.currentShow && showMatch.currentShow.show) {

      if ((!this.showMgr.currentlyPlaying) || showMatch.currentShow.show.id !== this.showMgr.currentlyPlaying.id) {
        this.logger.info(METHOD_NAME, 'starting show', showMatch)
        const showToPlay = showMatch.currentShow.show
        const currentlyPlaying = this.showMgr.isCurrentlyPlaying(showToPlay)
        if (!currentlyPlaying) {
          this.showMgr.startShow(showToPlay)
        } else {
          this.logger.trace(METHOD_NAME, 'did not play show, already playing or was null', currentlyPlaying, showToPlay)
        }
      }
    } else {
      if (showMatch.nextShow && showMatch.nextShow.show) {
        this.logger.trace(METHOD_NAME, 'waiting till show start', showMatch)
        this.onNoShowToPlay()
      }
    }

    if (showMatch === undefined ||
      ((showMatch.currentShow === undefined || showMatch.currentShow.show === undefined) && (showMatch.nextShow === undefined || showMatch.nextShow.show === undefined))) {
      this.onOutOfShowsToPlay()
    }
  }
  onNoShowToPlay() {
    const METHOD_NAME = "onNoShowToPlay"
    const currentlyPlaying = this.showMgr.isDefaultVideoPlaying()
    if (!currentlyPlaying) {
      this.showMgr.playDefaultVideo()
    } else {
      this.logger.trace(METHOD_NAME, 'did not play default show, already playing or was null', currentlyPlaying)
    }
  }

  onOutOfShowsToPlay() {
    console.log("no more days, stop system")
    this.active = false
    if (!this.intermissionStarted) {
      this.intermissionStarted = true
      this.showMgr.playDefaultVideo()
    }
  }

  static update(dt: number) {
    for(let instance of RunOfShowSystem.instances) {
      if(instance && instance.active) instance.update(dt)
    }
  }
}