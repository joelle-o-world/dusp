import Unit from "../Unit.js"

class Ramp extends Unit {
  constructor(duration, y0, y1) {
    super()

    this.addOutlet("out", {mono: true, type:"control"})

    this.duration = duration || this.sampleRate
    this.y0 = y0 || 1
    this.y1 = y1 || 0

    this.t = 0
    this.playing = false
  }

  trigger() {
    this.playing = true
    this.t = 0
    return this
  }

  _tick() {
    for(var tChunk=0; tChunk<this.out.length; tChunk++) {
      if(this.playing) {
        this.t++
        if(this.t > this.duration) {
          this.playing = false
          this.t = this.duration
        }
        if(this.t < 0) {
          this.playing = false
          this.t = 0
        }
      }
      this.out[tChunk] = this.y0 + (this.t/this.duration) * (this.y1-this.y0)
    }
  }
}
export default Ramp
