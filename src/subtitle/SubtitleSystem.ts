import { parseSync } from "../subtitleHelper/parseSync";
import { NodeCue } from "../subtitleHelper/types";

export interface IndexedNodeCue extends NodeCue {
  index: number
}

export enum SubtitleCueEvent {
  CUE_BEGIN,
  CUR_END
}

declare type ShowSubtitleSystemListener = (cue: NodeCue, event: SubtitleCueEvent) => void;

export class SubtitleSystem {
  static readonly INVALID_OFFSET: number = -1

  offsetMs: number = 0
  paused: boolean = true
  maxEndOffsetMs: number = 0

  cueList: IndexedNodeCue[] = []
  firedCues: number[] = []

  onCueListenerList: ShowSubtitleSystemListener[] = []

  constructor() { }

  addCueListener(listener: ShowSubtitleSystemListener) {
    this.onCueListenerList.push(listener)
  }
  
  setSubtitlesString(subtitleStr: string, autoMaxOffset: boolean = true) {
    try {
      const ordededCue = (
        parseSync(subtitleStr).filter(
          (value) => value.type == 'cue'
        ) as IndexedNodeCue[]
      ).sort((a, b) => a.data.start - b.data.start)

      this.cueList = ordededCue.map((value, index) => ({ ...value, index }))
      if (autoMaxOffset) {
        this.maxEndOffsetMs = Math.max(...this.cueList.map(($) => $.data.end))
      }

      this.offsetMs = 0
      this.firedCues = []
      this.paused = false
      return true
    } catch {
      this.cueList = []
      this.offsetMs = SubtitleSystem.INVALID_OFFSET
      this.maxEndOffsetMs = SubtitleSystem.INVALID_OFFSET
      this.paused = false
      return false
    }
  }

  setOffset(newOffset: number) {
    const previousOffset = this.offsetMs
    if (
      previousOffset == newOffset ||
      newOffset == SubtitleSystem.INVALID_OFFSET
    ) {
      return
    }

    this.offsetMs = newOffset

    // Filter by cues with time window in 'newOffset'
    const currentCues = this.cueList.filter(
      ($) => newOffset >= $.data.start && newOffset < $.data.end
    )

    // Filter currentCues by cues hasn't fired yet
    const firableCues = currentCues.filter(
      ($) => this.firedCues.indexOf($.index) == -1
    )

    // Filter firedCues by cues there aren't anymore in currentCues
    const endedCues = this.firedCues
      .filter((i) => currentCues.filter(($) => $.index == i).length == 0)
      .map((index) => this.cueList[index])

    // Fire old cues end
    endedCues.forEach((cue) => {
      this.onCueEnd(cue)
    })

    // Fire new cues start
    firableCues.forEach((cue) => {
      this.onCueBegin(cue)
    })

    // Update the firedEvents
    if (endedCues.length > 0 || firableCues.length > 0) {
      this.firedCues = currentCues.map(($) => $.index)
    }
  }

  protected onCueBegin(cue: NodeCue) {
    this.fireCueEvent(cue, SubtitleCueEvent.CUE_BEGIN)
  }

  private fireCueEvent(cue: NodeCue, event: SubtitleCueEvent) {
    if (this.onCueListenerList) {
      for (const p in this.onCueListenerList) {
        this.onCueListenerList[p](cue, event)
      }
    }
  }

  protected onCueEnd(cue: NodeCue) {
    this.fireCueEvent(cue, SubtitleCueEvent.CUR_END)
  }

  clearFiredEvents() {
    this.firedCues = []
  }

  setMaxLength(value: number) {
    this.maxEndOffsetMs = value
  }

  pause() {
    this.paused = true
  }

  resume() {
    this.paused = false
  }

  getOffsetMs() {
    return this.offsetMs
  }

  seekTime(offsetSeconds: number) {
    this.setOffset((offsetSeconds * 1000) + this.offsetMs)  
  }

  update(dt: number) {
    if (this.offsetMs != SubtitleSystem.INVALID_OFFSET && !this.paused) {
      let newOffset = this.offsetMs + dt * 1000.0
      //if past end, pin it to end
      if (this.maxEndOffsetMs > 0 && newOffset > this.maxEndOffsetMs) {
        newOffset = this.maxEndOffsetMs
        this.paused = true //at the end, pause/stop it
      }
      this.setOffset(newOffset)
    }
  }
}
