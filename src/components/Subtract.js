const Unit = require("../Unit.js")
const config = require("../config.js")

function Subtract(A, B) {
  Unit.call(this)
  this.addInlet("a")
  this.addInlet("b")
  this.addOutlet("out")

  this.A = A || 0
  this.B = B || 0
}
Subtract.prototype = Object.create(Unit.prototype)
Subtract.prototype.constructor = Subtract
module.exports = Subtract

const zeroChunk = new Float32Array(config.standardChunkSize).fill(0)

Subtract.prototype._tick = function() {
  for(var c=0; c<this.a.length || c<this.b.length; c++) {
    if(!this.out[c])
      this.out[c] = new Float32Array(this.OUT.chunkSize)
    var aChunk = this.a[c] || zeroChunk
    var bChunk = this.b[c] || zeroChunk
    for(var t=0; t<aChunk.length; t++) {
      this.out[c][t] = aChunk[t] - bChunk[t]
    }
  }
}
