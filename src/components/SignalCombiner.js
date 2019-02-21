const Unit = require("../Unit.js")

function SignalCombiner(a, b) {
  Unit.call(this)

  this.addInlet("a")
  this.addInlet("b")
  this.addOutlet("out")

  this.A = a || 0
  this.B = b || 0
}
SignalCombiner.prototype = Object.create(Unit.prototype)
SignalCombiner.prototype.constructor = SignalCombiner
module.exports = SignalCombiner

SignalCombiner.prototype.collapseA = function() {
  var outInlets = this.OUT.connections
  for(var i in outInlets) {
    outInlets[i].connect(this.A.outlet)
  }
  this.A.disconnect()
  this.B.disconnect()
}
SignalCombiner.prototype.collapseB = function() {
  var outInlets = this.OUT.connections
  for(var i in outInlets) {
  //  console.log(this.label +".collapseB,", outInlets[i].label, ".connect(", this.B.outlet.label, ")")
    outInlets[i].connect(this.B.outlet)
  }
  this.A.disconnect()
  this.B.disconnect()
}
