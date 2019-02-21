const Unit = require("../Unit.js")

function ConcatChannels(A, B) {
  Unit.call(this)
  this.addInlet("a")
  this.addInlet("b")
  this.addOutlet("out")

  this.A = A || 0
  this.B = B || 0
}
ConcatChannels.prototype = Object.create(Unit.prototype)
ConcatChannels.prototype.constructor = ConcatChannels
module.exports = ConcatChannels

ConcatChannels.prototype._tick = function() {
  var nCOut = this.a.length + this.b.length
  for(var c=0; c<this.a.length; c++) {
    var outChunk = this.out[c] = this.out[c] || new Float32Array(this.OUT.chunkSize)
    var inChunk = this.a[c]
    for(var t=0; t<inChunk.length; t++)
      outChunk[t] = inChunk[t]
  }
  for(c=c; c<nCOut; c++) {
    var outChunk = this.out[c] = this.out[c] || new Float32Array(this.OUT.chunkSize)
    var inChunk = this.b[c-this.a.length]
    for(var t=0; t<inChunk.length; t++)
      outChunk[t] = inChunk[t]
  }
}
