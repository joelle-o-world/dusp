import config from "./config"

class Event{
  constructor(time, f, unit, circuit) {
    this.time = time// perhaps as a general rule, t is in samples but time is in seconds
    this.function = f
    this.unit = unit
    this.circuit = circuit
  }

  get time() {
    return this.t / config.sampleRate
  }

  set time(time) {
    this.t = time * config.sampleRate
  }

  run() {
    var subject = this.unit || this.circuit || null
    var returnValue = this.function.call(subject)
    if(returnValue > 0)
      return new Event(
        this.time + returnValue,
        this.function,
        this.unit,
        this.circuit,
      )
    else
      return null
  }
}
export default Event
