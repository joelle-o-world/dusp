const Unit = require("../Unit.js")

function DecibelToScaler(input) {
  Unit.call(this)
  this.addInlet("in", {measuredIn:"dB"})
  this.addOutlet("out")
  this.IN = input || 0
}
DecibelToScaler.prototype = Object.create(Unit.prototype)
DecibelToScaler.prototype.constructor = DecibelToScaler
module.exports = DecibelToScaler

DecibelToScaler.prototype._tick = function() {
  for(var c=0; c<this.in.length; c++) {
    this.out[c] = this.out[c] || new Float32Array(this.in[c].length)
    for(var t=0; t<this.in[c].length; t++)
      this.out[c][t] = Math.pow(10, this.in[c][t]/20)
  }
}
