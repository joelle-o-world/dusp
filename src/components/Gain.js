const Unit = require("../Unit.js")

function Gain(gain) {
  Unit.call(this)
  this.addInlet("in")
  this.addInlet("gain", {mono: true, measuredIn: "dB"})
  this.addOutlet("out")

  this.GAIN = gain || 0
}
Gain.prototype = Object.create(Unit.prototype)
Gain.prototype.constructor = Gain
module.exports = Gain

Gain.prototype.isGain

Gain.prototype._tick = function() {
  for(var c=0; c<this.in.length; c++) {
    if(this.out[c] == undefined)
      this.out[c] = new Float32Array(this.OUT.chunkSize)
    for(var t=0; t<Unit.standardChunkSize; t++)
      this.out[c][t] = dB(this.gain[t]) * this.in[c][t]
  }
}

function dB(db) { // decibel to scale factor (for amplitude calculations)
  return Math.pow(10, db/20);
}
