import { Entity, PBVideoEvent, PBVideoPlayer, Transform, VideoPlayer, VideoState, VideoTexture, engine, videoEventsSystem } from "@dcl/sdk/ecs";

export const DefaultVideoEvent: PBVideoEvent = {
  timestamp: -1,
  tickNumber: -1,
  currentOffset: -1,
  videoLength: -1,
  state: VideoState.VS_NONE,
}

export declare type VideoChangeStatusCallback = (oldStatus: VideoState, newStatus: VideoState) => void;

export class VideoChangeStatusListener {
  enabled: boolean = true
  constructor(public callback: VideoChangeStatusCallback) {
    this.callback = callback
  }

  update(oldStatus: VideoState, newStatus: VideoState) {
    if (!this.enabled) return
    this.callback(oldStatus, newStatus)
  }
}

export class VideoSystem {
  videoPlayerEntity: Entity
  elapsedTime: number
  lastVideoEventData: PBVideoEvent = DefaultVideoEvent
  estimatedOffset: number

  lastEventTime: number = 0
  resumePlayAdjusted: boolean = true

  changeStatusListeners: VideoChangeStatusListener[] = []

  constructor(_videoPlayer: PBVideoPlayer) {
    this.elapsedTime = 0
    this.estimatedOffset = -1

    this.videoPlayerEntity = engine.addEntity()
    Transform.create(this.videoPlayerEntity)
    VideoPlayer.create(this.videoPlayerEntity, _videoPlayer)

    const self = this
    videoEventsSystem.registerVideoEventsEntity(
      this.videoPlayerEntity,
      function (videoEvent) {
        self.updateEvent(videoEvent)
      }
    )
  }

  reset(_videoPlayer: PBVideoPlayer) {
    this.elapsedTime = 0
    this.estimatedOffset = -1
    this.lastVideoEventData = DefaultVideoEvent
    this.lastEventTime = 0
    this.resumePlayAdjusted = true

    VideoPlayer.createOrReplace(this.videoPlayerEntity, _videoPlayer)
  }

  setOffset(offsetSeconds: number) {
    this.estimatedOffset = offsetSeconds
    this.onOffsetUpdate(this.estimatedOffset)
  }

  update(dt: number) {
    this.elapsedTime += dt
    if (this.lastVideoEventData.state === VideoState.VS_PLAYING) {
      if (this.resumePlayAdjusted == false) {
        this.resumePlayAdjusted = true
        const now = Date.now()
        this.estimatedOffset += dt - ((now - this.lastEventTime) / 1000)
      } else {
        this.estimatedOffset += dt
      }

      this.onOffsetUpdate(this.estimatedOffset)
    }
  }

  /**
   * Triggered when renderer send an event with status different that previous
   * @param oldStatus
   * @param newStatus
   */
  protected onChangeStatus(oldStatus: VideoState, newStatus: VideoState) {
    for (let p in this.changeStatusListeners) {
      this.changeStatusListeners[p].update(oldStatus, newStatus)
    }
  }

  /**
   *  Triggered every frame while the video is playing
   * @param estimatedOffset offset position in seconds. Can be -1 (invalid offset)
   */
  protected onOffsetUpdate(estimatedOffset: Number) { }

  private updateEvent(event: PBVideoEvent) {
    if (
      this.lastVideoEventData.state === undefined ||
      this.lastVideoEventData.state !== event.state
    ) {
      if (event.state === VideoState.VS_PLAYING) {
        this.setOffset(event.currentOffset)
        this.resumePlayAdjusted = false
      }

      this.onChangeStatus(
        this.lastVideoEventData.state || VideoState.VS_NONE,
        event.state as VideoState
      )
    }
    this.lastEventTime = Date.now()
    this.lastVideoEventData = event
  }
}
