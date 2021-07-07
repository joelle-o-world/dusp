import Unit from "../Unit.js"
import config from "../config.js"

const samplePeriod = 1/config.sampleRate

class AHD extends Unit {
  constructor(attack, hold, decay) {
    super()

    this.addInlet("attack", {mono: true, type:"time", measuredIn:"s"})
    this.addInlet("hold", {mono: true, type:"time", measuredIn:"s"})
    this.addInlet("decay", {mono: true, type:"time", measuredIn:"s"})
    this.addOutlet("out", {mono: true, type:"control", min:0, max:1})

    this.ATTACK = attack || 0
    this.HOLD = hold || 0
    this.DECAY = decay || 0

    this.state = 0
    this.playing = false
    this.t = 0
  }

  trigger() {
    this.state = 1
    this.playing = true
    return this
  }
  stop() {
    this.state = 0
    this.playing = false
    return this
  }

  _tick() {
    for(var t=0; t<this.tickInterval; t++) {
      switch(this.state) {
        case 1: // attack
          this.out[t] = this.t
          if(this.playing) {
            this.t += samplePeriod/this.attack[t]
            if(this.t >= 1) {
              this.state++
              this.t--
            }
          }
          break;

        case 2: // hold
          this.out[t] = 1
          if(this.playing) {
            this.t += samplePeriod/this.hold[t]
            if(this.t >= 1) {
              this.state++
              this.t--
            }
          }
          break;

        case 3: // decay
          this.out[t] = 1-this.t

          if(this.playing) {
            this.t += samplePeriod/this.decay[t]
            if(this.t >= 1) {
              this.stop()
            }
          }
          break;

        case 0: // off
          this.out[t] = 0

      }
    }
  }

  static random(duration) {
    var a = Math.random()
    var h = Math.random()
    var d = Math.random()
    var scale = duration/(a + h + d)

    a *= scale
    h *= scale
    d *= scale

    return new AHD(a, h, d)
  }
}
export default AHD

