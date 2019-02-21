const Unit = require("../Unit.js")

function Monitor(input) {
  Unit.call(this)
  this.addInlet("in")

  this.IN = input
}
Monitor.prototype = Object.create(Unit.prototype)
Monitor.prototype.constructor = Monitor
module.exports = Monitor

Monitor.prototype._tick = function() {
  console.log(this.in)
}
