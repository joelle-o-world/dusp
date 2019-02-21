const Unit = require("../Unit.js")

function FixedMultiply(sf, input) {
  Unit.call(this)

  this.addInlet("in", {mono: true})
  this.addOutlet("out", {mono: true})

  this.sf = sf

  this.IN = input || 0
}
FixedMultiply.prototype = Object.create(Unit.prototype)
FixedMultiply.prototype.constructor = FixedMultiply
module.exports = FixedMultiply

FixedMultiply.prototype.isFixedMultiply = true

FixedMultiply.prototype._tick = function() {
  for(var t=0; t<this.in.length; t++)
    this.out[t] = this.in[t] * this.sf
}
