const Unit = require("../Unit.js")

function LessThan(input, val) {
  console.log("WARNING: LessThan is untested")
  Unit.call(this)
  this.addInlet("in", {mono: true})
  this.addInlet("val", {mono: true})
  this.addOutlet("out", "bool")

  this.IN = input || 0
  this.VAL = val || 0
}
LessThan.prototype = Object.create(Unit.prototype)
LessThan.prototype.constructor = LessThan
module.exports = LessThan

LessThan.prototype._tick = function() {
  for(var t=0; t<this.in.length; t++) {
    this.out[t] = (this.in[t] < this.val[t])
  }
}
