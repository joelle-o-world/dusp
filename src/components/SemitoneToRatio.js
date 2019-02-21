const Unit = require("../Unit.js")

function SemitoneToRatio(midi) {
  Unit.call(this)
  this.addInlet("in")
  this.addOutlet("out")

  this.IN = midi || 69
}
SemitoneToRatio.prototype = Object.create(Unit.prototype)
SemitoneToRatio.prototype.constructor = SemitoneToRatio
module.exports = SemitoneToRatio

SemitoneToRatio.prototype._tick = function() {
  for(var c=0; c<this.in.length; c++) {
    var midiIn = this.in[c]
    var fOut = this.out[c] = this.out[c] || new Float32Array(this.OUT.chunkSize)

    for(var t=0; t<midiIn.length; t++)
      fOut[t] = Math.pow(2, (midiIn[t]/12))
  }
}
