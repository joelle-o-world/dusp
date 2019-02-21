const Unit = require("../Unit.js")

function Ramp(duration, y0, y1) {
  Unit.call(this)

  this.addOutlet("out", {mono: true, type:"control"})

  this.duration = duration || this.sampleRate
  this.y0 = y0 || 1
  this.y1 = y1 || 0

  this.t = 0
  this.playing = false
}
Ramp.prototype = Object.create(Unit.prototype)
Ramp.prototype.constructor = Ramp
module.exports = Ramp

Ramp.prototype.trigger = function() {
  this.playing = true
  this.t = 0
  return this
}

Ramp.prototype._tick = function() {
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
