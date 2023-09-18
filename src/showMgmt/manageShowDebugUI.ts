import * as utils from '@dcl-sdk/utils'
import { ShowManager } from './manageShow'
import { RunOfShowSystem } from './runOfShowSystem'
import { ShowHUD } from './showhud/ShowHUD'

export class ManageShowDebugUI {

  private static instance: ManageShowDebugUI

  displayNameValue: string
  videoTimeValue: string
  enabled: boolean = false
  checkIntervalSeconds = .1
  UI_timeLapse = 0

  videoEstimatedOffset: number = 0
  elapsedTime: number = 0
  subtitleOffset: number = 0

  actionMgrProcessed: number = 0
  actionMgrWarnings: number = 0
  actionMgrErrors: number = 0


  showHud: ShowHUD

  public static getInstance(): ManageShowDebugUI {
    if (!ManageShowDebugUI.instance) {
      ManageShowDebugUI.instance = new ManageShowDebugUI();
    }

    return ManageShowDebugUI.instance;
  }

  init() {
    this.showHud = new ShowHUD()
  }
  setVideoStatus(val: string) {
    this.showHud.videoStatusValue = val
  }
  updateVideoTimeValue(videoEstimatedOffset: number, elapsedTime: number, subtitleSystemOffsetMs: number) {
    this.videoEstimatedOffset = videoEstimatedOffset
    this.elapsedTime = elapsedTime
    this.subtitleOffset = subtitleSystemOffsetMs
  }
  updateDisplayNameValue(val: string) {
    this.displayNameValue = val
  }
  updateUICounter(dt: number) {
    this.UI_timeLapse += dt
    //manage high frequency update values
    if (this.UI_timeLapse > this.checkIntervalSeconds) {
      this.UI_timeLapse = 0

      if (this.showHud) {
        this.showHud.playTimesValue = this.videoEstimatedOffset.toFixed(2) + '/' + this.elapsedTime.toFixed(2) + '/' + (this.subtitleOffset / 1000).toFixed(2)
        this.showHud.displayNameValue = this.displayNameValue
        this.showHud.actionCountsValue = this.actionMgrProcessed.toFixed(0) + '/' + this.actionMgrWarnings.toFixed(0) + "/" + (this.actionMgrErrors).toFixed(0)
      }
    }
  }
  setToLoading() {
    if (this.showHud) {
      this.showHud.videoStatusValue = 'LOADING'
    }
  }
  resetCounters() {
    this.UI_timeLapse = 0
    this.actionMgrProcessed = 0
    this.actionMgrErrors = 0
    this.actionMgrWarnings = 0
  }
  setEnabled(val: boolean) {
    this.enabled = val

    this.toggleVisible(this.enabled)
  }
  toggleVisible(val: boolean) {
  }
}

function playNext(manageShowDebugUI: ManageShowDebugUI, showMgr: ShowManager, runOfShow: RunOfShowSystem, dir: number) {


  if (runOfShow && runOfShow.enabled) {
    manageShowDebugUI.showHud.setNotificationText()
    return
  }
  let fromTime = new Date()
  if (showMgr.currentlyPlaying) {

    fromTime = new Date((showMgr.currentlyPlaying.startTime * 1000) + 1000)
    console.log("findShowToPlayByDate.showMgr.currentlyPlaying", showMgr.currentlyPlaying, "fromTime", fromTime.toLocaleString())
  }

  const showResults = showMgr.showSchedule.findShowToPlayByDate(fromTime, -1)
  console.log("showResults ", new Date().toLocaleString(), showResults, fromTime.getTime(), fromTime.toLocaleString(), showResults)
  const showToPlay = dir > 0 ? showResults.nextShow : showResults.lastShow
  if (showToPlay) {
    if (showMgr.videoSystem) showMgr.videoSystem.stop()
    utils.timers.setTimeout(
      function () {
        showMgr.playVideo(showToPlay.show, 0)
      },
      100
    )
  }

  manageShowDebugUI.showHud.paused = true
}

export function registerWithDebugUI(manageShowDebugUI: ManageShowDebugUI, showMgr: ShowManager, runOfShow: RunOfShowSystem) {

  manageShowDebugUI.showHud.onPause = () => { showMgr.pause() }
  manageShowDebugUI.showHud.onPlay = () => { showMgr.play() }
  manageShowDebugUI.showHud.onPlayNext = () => { playNext(manageShowDebugUI, showMgr, runOfShow, 1); }
  manageShowDebugUI.showHud.onPlayPrev = () => { playNext(manageShowDebugUI, showMgr, runOfShow, -1); }

  manageShowDebugUI.showHud.onRunOfShowPause = () => { runOfShow.pause() }
  manageShowDebugUI.showHud.onRunOfShowPlay = () => { runOfShow.play() }

  manageShowDebugUI.showHud.onRunOfShowRestart = () => {
    let counter = 0

    const padding = (5 * 1000) //5 seconds

    //push show schedule up
    const showData = showMgr.showSchedule.getData()
    for (const p in showData.shows) {
      const show = showData.shows[p]
      if (show.startTime > 0) {
        show.startTime = new Date(Date.now() + counter + padding).getTime() / 1000

        counter += padding + (show.length * 1000)
      }
    }
    showMgr.showSchedule.setData(showData)
    showMgr.stopShow()
    runOfShow.reset()
    runOfShow.enabled = true
  }
}
