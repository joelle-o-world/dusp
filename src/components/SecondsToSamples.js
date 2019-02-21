const Unit = require("../Unit.js")
const config = require('../config.js')

function SecondsToSamples() {
  Unit.call(this)
  this.addInlet("in", {measuredIn: "s"})
  this.addOutlet("out", {measuredIn: "samples"})
}
SecondsToSamples.prototype = Object.create(Unit.prototype)
SecondsToSamples.prototype.constructor = SecondsToSamples
module.exports = SecondsToSamples

SecondsToSamples.prototype._tick = function() {
  for(var c in this.in) {
    if(this.out[c] == undefined)
      this.out[c] = new Float32Array(this.OUT.chunkSize)
    for(var t=0; t<this.in[c].length; t++)
      this.out[c][t] = this.in[c][t] * config.sampleRate
  }
}
