import { fetchWorldTime } from './utils'

let PLAYING_DEFAULT: boolean = false


export class TimeProvider {

  promise: Promise<Date> | undefined
  whenMeasured: Date | undefined
  worldTime: Date | undefined

  constructor() {

  }

  async waitTillReady() {
    return this.promise
  }

  async getTime() {
    if (this.promise === undefined) {
      this.worldTime = new Date()
      this.whenMeasured = new Date()

      this.promise = fetchWorldTime()

      this.promise.then((date: Date) => {
        this.worldTime = date
      })
    }
    return this.promise
  }

  now(): number {
    if (!this.worldTime || !this.whenMeasured) {
      return Date.now()
    }

    //calculates world time offset
    return this.worldTime.getTime() + (Date.now() - this.whenMeasured.getTime())
  }

}
