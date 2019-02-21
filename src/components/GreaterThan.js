const Unit = require("../Unit.js")

function GreaterThan(input, val) {
  console.log("WARNING GreaterThan is untested!")
  Unit.call(this)
  this.addInlet("in", {mono: true})
  this.addInlet("val", {mono: true})
  this.addOutlet("out", "bool")

  this.IN = input || 0
  this.VAL = val || 0
}
GreaterThan.prototype = Object.create(Unit.prototype)
GreaterThan.prototype.constructor = GreaterThan
module.exports = GreaterThan

GreaterThan.prototype._tick = function() {
  for(var t=0; t<this.in.length; t++) {
    this.out[t] = (this.in[t] > this.val[t])
  }
}
