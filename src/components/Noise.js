const Unit = require("../Unit.js")

function Noise(f) {
  Unit.call(this)
  this.addInlet("f", {measuredIn:"Hz"})
  this.addOutlet("out", {type:"audio"})

  this.F = f || Unit.sampleRate
  this.phase = 0
  this.y = Math.random()*2 - 1
}
Noise.prototype = Object.create(Unit.prototype)
Noise.prototype.constructor = Noise
module.exports = Noise

Noise.prototype._tick = function() {
  for(var c in this.out) {
    var outChan = this.out[c]
    for(var t=0; t<outChan.length; t++) {
      this.phase += this.f[0][t]
      if(this.phase >= Unit.sampleRate) {
        this.phase = 0
        this.y = 2 * Math.random() - 1
      }
      outChan[t] = this.y
    }
  }
}
