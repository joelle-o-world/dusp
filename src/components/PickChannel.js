const Unit = require("../Unit.js")

function PickChannel(input, c) {
  Unit.call(this)
  this.addInlet("in")
  this.addInlet("c", {mono: true})
  this.addOutlet("out", {mono: true})

  this.IN = input || 0
  this.C = c || 0
}
PickChannel.prototype = Object.create(Unit.prototype)
PickChannel.prototype.constructor = PickChannel
module.exports = PickChannel

PickChannel.prototype._tick = function() {
  var chunkSize = this.OUT.chunkSize
  for(var t=0; t<chunkSize; t++) {
    this.out[t] = this.in[this.c[t] % this.in.length][t]
  }
}
