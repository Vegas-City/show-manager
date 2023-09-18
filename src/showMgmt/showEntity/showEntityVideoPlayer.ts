import { PBVideoPlayer } from '@dcl/sdk/ecs'
import { ShowEntitySupport } from './showEntity'

export class ShowEntityVideoPlayer extends ShowEntitySupport {
  myVideoPlayer: PBVideoPlayer

  constructor(
    myVideoPlayer: PBVideoPlayer
  ) {
    super()

    this.myVideoPlayer = myVideoPlayer
  }

  play(): void {
    this.myVideoPlayer.playing = true
  }
  stop(): void {
    this.myVideoPlayer.playing = false
  }
}