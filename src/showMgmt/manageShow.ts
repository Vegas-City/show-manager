import { Logger, LoggerFactory } from '../logging/logging'
import { IndexedNodeCue, SubtitleCueEvent, SubtitleSystem } from '../subtitle/SubtitleSystem'
import { NodeCue } from '../subtitleHelper/types'
import { DefineActionAliasActionHandler } from './actionHandlers/DefineActionAliasActionHandler'
import { DefineActionGroupActionHandler } from './actionHandlers/DefineActionGroupActionHandler'
import { DefineTargetGroupActionHandler } from './actionHandlers/DefineTargetGroupActionHandler'
import { ShowActionHandler } from './actionHandlers/showActionHandler'
import { ShowPauseAllActionHandler } from './actionHandlers/ShowPauseAllActionHandler'
import { ShowActionManager } from './manageShowActions'
import { ManageShowDebugUI } from './manageShowDebugUI'
import { ShowSchedule } from './showSchedule'
import { PlayShowEvent, ShowType, StopShowEvent } from './types'
import { removeItemFromArray } from './utils'
import { SubtitleVideoSystem } from './video/SubtitleVideoSystem'
import { VideoChangeStatusListener } from './video/VideoSystem'
import { engine, PBVideoPlayer, VideoPlayer, VideoState } from '@dcl/sdk/ecs'

let PLAYING_DEFAULT: boolean = false

export class ShowManager {
  logger: Logger
  currentlyPlaying: ShowType | null
  nextToPlay: ShowType | null

  actionMgr: ShowActionManager
  videoSystem: SubtitleVideoSystem
  subtitleSystem: SubtitleSystem | null = null

  showSchedule: ShowSchedule

  playVideoListeners: ((event: PlayShowEvent) => void)[] = []
  stopShowListeners: ((event: StopShowEvent) => void)[] = []
  changeStatusListeners: VideoChangeStatusListener[] = []

  sceneNotActiveYetToPlay: ShowType | null
  playPermissionsRequiredEnabled = false
  checkFirstTimeDone = false //default is true, only if you need sceneActive controls will you use this
  playPermissionsGiven = false //default is true, only if you need sceneActive controls will you use this

  manageShowDebugUI: ManageShowDebugUI

  //latestWorldTime:Date

  //// key functions

  constructor() {
    this.actionMgr = new ShowActionManager()
    this.showSchedule = new ShowSchedule()
    this.logger = LoggerFactory.getLogger("ShowManager")
  }

  enableDebugUI(val: boolean) {
    if (!this.manageShowDebugUI) {
      this.manageShowDebugUI = new ManageShowDebugUI()
      if (this.videoSystem) this.videoSystem.manageShowDebugUI = this.manageShowDebugUI
      if (this.actionMgr) this.actionMgr.manageShowDebugUI = this.manageShowDebugUI
    }
    this.manageShowDebugUI.init()
    this.manageShowDebugUI.setEnabled(val)

  }
  isPlaying(): boolean {
    if (this.videoSystem === undefined || this.videoSystem === null) return false

    const videoPlayer = VideoPlayer.getMutableOrNull(this.videoSystem.videoPlayerEntity)
    if (videoPlayer === undefined || videoPlayer === null || videoPlayer.playing === undefined || videoPlayer.playing === null) return false

    return videoPlayer.playing
  }
  pause() {
    const METHOD_NAME = "pause"
    this.logger.debug(METHOD_NAME, "")
    if (this.videoSystem) this.videoSystem.pause()
    this.runAction(ShowPauseAllActionHandler.DEFAULT_NAME)
  }
  play() {
    if (this.videoSystem) this.videoSystem.play()
  }
  isCurrentlyPlaying(showData: ShowType) {
    const METHOD_NAME = "isCurrentlyPlaying"
    const retVal = showData && this.currentlyPlaying && this.currentlyPlaying.id === showData.id
    this.logger.trace(METHOD_NAME, "", retVal, showData, this.currentlyPlaying)
    return retVal
  }
  setPlayPermissionsRequiredEnabled(val: boolean) {
    this.playPermissionsRequiredEnabled = val
  }
  checkStartFirstTime() {
    const METHOD_NAME = "checkStartFirstTime"
    if (this.checkFirstTimeDone) {
      return;
    }

    this.checkFirstTimeDone = true;

    if (this.sceneNotActiveYetToPlay === undefined || this.sceneNotActiveYetToPlay === null) {
      console.log(METHOD_NAME, "nothing queued to start!!!")
      return;
    }
    console.log(METHOD_NAME, "finally starting!!!")
    this.startShow(this.sceneNotActiveYetToPlay)
  }
  startShow(showData: ShowType) {
    const METHOD_NAME = "startShow"

    //TODO WHAT ABOUT PLAYING BUT NEED TO SEEK FORWARD

    if (!showData) {
      //TODO figure out how this should affect state, return boolean if did it?
      this.logger.info(METHOD_NAME, "data is null, doing nothing", showData, this.currentlyPlaying)
      return
    }
    const currentlyPlaying = this.isCurrentlyPlaying(showData)
    if (currentlyPlaying && !this.isPlaying()) {
      this.logger.info(METHOD_NAME, "already playing, but paused, letting it init again ", this.currentlyPlaying)

    } else if (currentlyPlaying && this.isPlaying()) {
      this.logger.info(METHOD_NAME, "already playing ", this.currentlyPlaying)
      return
    }


    this.currentlyPlaying = showData

    //FIXME ME not server synced
    let currentTime = Date.now() / 1000

    let startTime = showData.startTime
    let timeDiff = currentTime - startTime

    //of start time is negative its not a schedule play song 
    if (showData.startTime < 0) {
      this.logger.info(METHOD_NAME, "startShow was negative, dont calculate timeDiff")
      timeDiff = 0
    }

    this.logger.info(METHOD_NAME, "",
      'show started for ',
      showData.id,
      ' ',
      'CURRENT TIME: ',
      currentTime,
      ' SHOW START: ',
      showData.startTime,
      ' DIFF: ',
      timeDiff,
      ' seconds ago, show playing: ',
      showData
    )

    if (timeDiff >= showData.length * 60) {
      if (startTime < 0) { //if negative start time it can be played on demand
        this.logger.info(METHOD_NAME, 'starting show anyways, ', timeDiff, ' seconds late')
        //start anyways
        this.playVideo(showData, timeDiff)
      } else {
        this.logger.info(METHOD_NAME, 'show ended')
        return
      }
    } else {
      this.logger.info(METHOD_NAME, 'starting show, ', timeDiff, ' seconds late')

      this.playVideo(showData, timeDiff)
    }
  }
  addStopShowListeners(callback: (event: StopShowEvent) => void) {
    this.stopShowListeners.push(callback)
  }
  stopShow() {
    if (this.videoSystem) {
      const videoPlayer = VideoPlayer.getMutableOrNull(this.videoSystem.videoPlayerEntity)
      if (videoPlayer) {
        videoPlayer.playing = false
      }
    }

    if (this.subtitleSystem) {
      this.runAction('STOPALL')
    }

    this.currentlyPlaying = null

    PLAYING_DEFAULT = false

    if (this.stopShowListeners) {
      const stopShowEvent = {}
      for (const p in this.stopShowListeners) {
        this.stopShowListeners[p](stopShowEvent)
      }
    }
  }

  runAction(action: string) {
    this.actionMgr.runAction(action)
  }

  addPlayVideoListeners(callback: (event: PlayShowEvent) => void) {
    this.playVideoListeners.push(callback)
  }

  registerListenerToSubtitle(subtitleSystem: SubtitleSystem) {
    const METHOD_NAME = "registerListenerToSubtitle"
    subtitleSystem.addCueListener(
      (cue: NodeCue, event: SubtitleCueEvent) => {
        try {
          switch (event) {
            case SubtitleCueEvent.CUE_BEGIN:
              this.processOnCueBegin(cue)
              break;
          }
        } catch (e) {
          //DO not let this error bubble up, or state will be lost and all listeners wont get notified
          //it will cause them to be retried over and over.  maybe we want this at some point but not right now
          this.logger.warn(METHOD_NAME, "ManageShow processOnCueBegin listener failed. Catching so others can complete", event, cue, e)
        }
      }
    )
  }
  parseCue(cue: NodeCue): string[] {
    let actionNames = [cue.data.text]
    if (cue.data.text && cue.data.text.indexOf("\n")) {
      actionNames = cue.data.text.split("\n")
    }
    return actionNames
  }
  processOnCueBegin(cue: NodeCue) {
    const METHOD_NAME = "processOnCueBegin"
    let actionNames = this.parseCue(cue)
    this.logger.debug(METHOD_NAME, `Show subtitle  '${cue.data.text}' (${actionNames.length}) at time: ${cue.data.start}`)

    //BREAK LINE AND SEND MULTIPLE
    for (const p in actionNames) {
      this.runAction(actionNames[p].trim())
    }
  }
  processExpiredCues(offsetSeconds: number) {
    const METHOD_NAME = "processOnCueBegin"
    const offsetMS = (offsetSeconds) * 1000
    // Filter by cues with time window in 'newOffset'
    const pastCues = this.subtitleSystem.cueList.filter(
      ($) => offsetMS > $.data.end
    )
    this.logger.debug(METHOD_NAME, "processExpiredCues found these pastCues that expired", pastCues)

    //FIXME THIS is greedy,maybe have the handler describe itself for a more dynamic lookup
    //find handlers that define things as we need these definitions still
    const handlerNamesToProcessExpired: string[]
      = [DefineActionGroupActionHandler.DEFAULT_NAME, DefineTargetGroupActionHandler.DEFAULT_NAME, DefineActionAliasActionHandler.DEFAULT_NAME]
    const handlers: ShowActionHandler<any>[] = this.actionMgr.getRegisteredHandlers(handlerNamesToProcessExpired)

    let allActionNames: string[] = []

    for (const p in pastCues) {
      const cue: IndexedNodeCue = pastCues[p]
      let actionNames = this.parseCue(cue)

      //TODO need to figure out how to compute backwards offsets to allow partial,offset playing???
      for (const p in actionNames) {
        allActionNames.push(actionNames[p])
      }
    }

    this.actionMgr.processActions(allActionNames, handlers)

  }
  playVideo(showData: ShowType, offsetSeconds: number) {
    const METHOD_NAME = "playVideo"

    this.logger.info(METHOD_NAME, 'playVideo show ', showData)

    this.stopShow()

    if (this.playPermissionsRequiredEnabled && (!this.checkFirstTimeDone && !this.playPermissionsGiven)) {
      this.logger.info(METHOD_NAME, "intercepted play because checkFirstTimeDone not started yet ", showData)
      this.sceneNotActiveYetToPlay = showData
      return;
    }

    if (this.manageShowDebugUI && this.manageShowDebugUI.enabled) {
      this.manageShowDebugUI.updateDisplayNameValue(showData.artist)
    }

    this.currentlyPlaying = showData

    const myVideoPlayer: PBVideoPlayer = {
      src: showData.link,
      playing: false
    }
    if (showData.loop !== undefined) myVideoPlayer.loop = showData.loop

    if(this.subtitleSystem === undefined || this.subtitleSystem === null) {
      this.subtitleSystem = new SubtitleSystem()
      this.registerListenerToSubtitle(this.subtitleSystem)
    }

    this.subtitleSystem.setSubtitlesString(showData.subs)

    //prescan for errors / load define definitions
    this.processExpiredCues(offsetSeconds)

    let firstTimePlaying = true
    const onPlaySeek = new VideoChangeStatusListener((oldStatus: VideoState, newStatus: VideoState) => {
      this.logger.debug(METHOD_NAME, "VideoChangeStatusListener.onPlaySeek fire", newStatus)
      switch (newStatus) {
        case VideoState.VS_PLAYING:
          this.logger.info(METHOD_NAME, "SEEKING!!!!", offsetSeconds, this.currentlyPlaying)
          if (firstTimePlaying) {
            firstTimePlaying = false
            this.videoSystem.setOffsetSeekVideo(offsetSeconds)
          }

          onPlaySeek.enabled = false

          this.removeVideoStatusChangeListener(onPlaySeek)
          break;
      }

    })
    this.addVideoStatusChangeListener(onPlaySeek)

    if (this.manageShowDebugUI) this.manageShowDebugUI.resetCounters()

    if (SubtitleVideoSystem.instance === undefined || SubtitleVideoSystem.instance === null) {
      this.videoSystem = new SubtitleVideoSystem(myVideoPlayer, this.subtitleSystem, this.manageShowDebugUI)
    }
    else {
      this.videoSystem.reset(myVideoPlayer)
    }

    this.videoSystem.changeStatusListeners.push(
      new VideoChangeStatusListener((oldStatus: VideoState, newStatus: VideoState) => {
        this.logger.debug(METHOD_NAME, "VideoChangeStatusListener this.videoSystem.changeStatusListeners", this.changeStatusListeners.length)
        for (const p in this.changeStatusListeners) {
          this.changeStatusListeners[p].update(oldStatus, newStatus)
        }
      }
      ))

    myVideoPlayer.playing = true

    let artistSignAnimation = 'artist' + (showData.id + 1)

    this.logger.debug(METHOD_NAME, 'ARTIST NAME', artistSignAnimation)

    this.runAction(artistSignAnimation)

    if (this.playVideoListeners) {
      const playShowEvent: PlayShowEvent = { showData: showData, offsetSeconds: offsetSeconds, videoPlayerEntity: this.videoSystem.videoPlayerEntity }
      for (const p in this.playVideoListeners) {
        this.playVideoListeners[p](playShowEvent)
      }
    }
  }
  removeVideoStatusChangeListener(listener: VideoChangeStatusListener) {
    this.changeStatusListeners = removeItemFromArray(this.changeStatusListeners, listener)
  }
  addVideoStatusChangeListener(listener: VideoChangeStatusListener) {
    this.changeStatusListeners.push(listener)
  }
  isDefaultVideoPlaying() {
    return this.isCurrentlyPlaying(this.showSchedule.getDefaultVideo())
  }
  playDefaultVideo() {
    this.startShow(this.showSchedule.getDefaultVideo())

    PLAYING_DEFAULT = true
  }
}