const Unit = require("../Unit.js")

function Rescale(inLower, inUpper, outLower, outUpper) {
  Unit.call(this)
  this.addInlet("in")
  this.addInlet("inLower")
  this.addInlet("inUpper")
  this.addInlet("outLower")
  this.addInlet("outUpper")
  this.addOutlet("out")

  this.IN = 0
  this.INLOWER = inLower || -1
  this.INUPPER = inUpper || 1
  this.OUTLOWER = outLower || 0
  this.OUTUPPER = outUpper || 1
}
Rescale.prototype = Object.create(Unit.prototype)
Rescale.prototype.constructor = Rescale
module.exports = Rescale

Rescale.prototype.isRescale = true

Rescale.prototype._tick = function() {
  for(var c=0; c<this.in.length; c++) {
    var inChan = this.in[c]
    var outChan = this.out[c] = this.out[c] || new Float32Array(Unit.standardChunkSize)
    var inLowerChan = this.inLower[c%this.inLower.length]
    var inUpperChan = this.inUpper[c%this.inUpper.length]
    var outLowerChan = this.outLower[c%this.outLower.length]
    var outUpperChan = this.outUpper[c%this.outUpper.length]
    for(var t=0; t<inChan.length; t++) {
      outChan[t] = (inChan[t]-inLowerChan[t])/(inUpperChan[t]-inLowerChan[t]) *
                    (outUpperChan[t] - outLowerChan[t]) + outLowerChan[t]
    }
  }
}
