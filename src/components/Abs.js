const Unit = require("../Unit.js")

function Abs(input) {
  Unit.call(this)

  this.addInlet("in")
  this.addOutlet("out")

  this.IN = input || 0
}
Abs.prototype = Object.create(Unit.prototype)
Abs.prototype.constructor = Abs
module.exports = Abs

Abs.prototype.isAbs = true

Abs.prototype._tick = function() {
  for(var c=0; c<this.in.length; c++) {
    this.out[c] = this.out[c] || new Float32Array(Unit.standardChunkSize)
    for(var t=0; t<this.in[c].length; t++) {
      this.out[c][t] = Math.abs(this.in[c][t])
    }
  }
}
