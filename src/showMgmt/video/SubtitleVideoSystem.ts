

import { PBVideoPlayer, VideoPlayer, VideoState, engine } from "@dcl/sdk/ecs";
import { Logger, LoggerFactory } from "../../logging/logging";
import { SubtitleSystem } from "../../subtitle/SubtitleSystem";
import { ManageShowDebugUI } from "../manageShowDebugUI";
import { VideoSystem } from "./VideoSystem";

export class SubtitleVideoSystem extends VideoSystem {
  static instance: SubtitleVideoSystem | null = null

  subtitleSystem: SubtitleSystem
  manageShowDebugUI: ManageShowDebugUI | null = null
  logger: Logger

  constructor(_videoPlayer: PBVideoPlayer, subtitleSystem?: SubtitleSystem, manageShowDebugUI?: ManageShowDebugUI) {
    super(_videoPlayer)
    this.subtitleSystem = subtitleSystem
    this.manageShowDebugUI = manageShowDebugUI
    this.logger = LoggerFactory.getLogger("SubtitleVideoSystem")


    if (SubtitleVideoSystem.instance === undefined || SubtitleVideoSystem.instance === null) {
      SubtitleVideoSystem.instance = this
      engine.addSystem(SubtitleVideoSystem.update)
    }
  }
  reset(_videoPlayer: PBVideoPlayer) {
    super.reset(_videoPlayer)
    this.subtitleSystem.pause()
    if(this.manageShowDebugUI) this.manageShowDebugUI.setToLoading()
  }
  stop() {
    const videoPlayer = VideoPlayer.getMutableOrNull(this.videoPlayerEntity)
    if (videoPlayer) {
      videoPlayer.playing = false
      videoPlayer.position = -1
    }
  }
  pause() {
    //no need to pause subtitle, event listener for video state change will trigger pause
    const videoPlayer = VideoPlayer.getMutableOrNull(this.videoPlayerEntity)
    if (videoPlayer) {
      videoPlayer.playing = false
    }
  }
  play() {
    //no need to pause subtitle, event listener for video state change will trigger play
    const videoPlayer = VideoPlayer.getMutableOrNull(this.videoPlayerEntity)
    if (videoPlayer) {
      videoPlayer.playing = true
    }
  }
  setOffset(offsetSeconds: number) {
    super.setOffset(offsetSeconds)
    this.subtitleSystem.setOffset(this.estimatedOffset * 1000)
  }
  setOffsetSeekVideo(offsetSeconds: number) {
    this.setOffset(offsetSeconds)

    const videoPlayer = VideoPlayer.getMutableOrNull(this.videoPlayerEntity)
    if (videoPlayer) {
      videoPlayer.position = offsetSeconds
    }
  }
  seek(offsetSeconds: number) {
    this.estimatedOffset += offsetSeconds
    this.onOffsetUpdate(this.estimatedOffset)

    const videoPlayer = VideoPlayer.getMutableOrNull(this.videoPlayerEntity)
    if (videoPlayer) {
      videoPlayer.position = offsetSeconds
    }
    
    this.subtitleSystem.seekTime(offsetSeconds)
  }
  //TODO consider subscription model
  onChangeStatus(oldStatus: VideoState, newStatus: VideoState) {
    const videoPlayer = VideoPlayer.getMutableOrNull(this.videoPlayerEntity)
    const videoName: string = videoPlayer ? videoPlayer.src : "null"

    const METHOD_NAME = "onChangeStatus"
    if (newStatus == VideoState.VS_PLAYING) {
      this.logger.debug(METHOD_NAME,
        `VideoTexture ${videoName} is now playing! Offset ${this.estimatedOffset}`
      )
      if (this.subtitleSystem) {
        this.subtitleSystem.resume()
      }
    } else {
      this.logger.debug(METHOD_NAME,
        `VideoTexture ${videoName} changed status to '${newStatus}'`
      )
      if (this.subtitleSystem) {
        this.subtitleSystem.pause()
      }
    }

    if (this.manageShowDebugUI && this.manageShowDebugUI.enabled) this.manageShowDebugUI.setVideoStatus(videoStatusAsString(newStatus))

    super.onChangeStatus(oldStatus, newStatus)
  }

  update(dt: number): void {
    super.update(dt)
    this.subtitleSystem.update(dt)

    if (this.manageShowDebugUI && this.manageShowDebugUI.enabled) {
      this.manageShowDebugUI.updateUICounter(dt)
    }
  }

  onOffsetUpdate(estimatedOffset: number) {
    if (this.manageShowDebugUI && this.manageShowDebugUI.enabled) {
      this.manageShowDebugUI.updateVideoTimeValue(estimatedOffset, this.elapsedTime, this.subtitleSystem.offsetMs)
    }
  }

  static update(dt: number) {
    if (SubtitleVideoSystem.instance === undefined || SubtitleVideoSystem.instance === null) return

    SubtitleVideoSystem.instance.update(dt)
  }
}

// instance systems
function videoStatusAsString(status: VideoState) {
  switch (status) {
    case VideoState.VS_NONE: return "NONE" //0
    case VideoState.VS_ERROR: return "ERROR" //1
    case VideoState.VS_LOADING: return "LOADING" //2
    case VideoState.VS_READY: return "READY" //3
    case VideoState.VS_PLAYING: return "PLAYING" //4
    case VideoState.VS_BUFFERING: return "BUFFERING" //5
    case VideoState.VS_SEEKING: return "SEEKING" //6
    case VideoState.VS_PAUSED: return "PAUSED" //7
    default: return "UNKNOWN:" + status
  }
}