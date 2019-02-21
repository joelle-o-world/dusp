const Unit = require("../Unit.js")

function CrossFader(a, b, dial) {
  Unit.call(this)
  this.addInlet("a", {type:"audio"})
  this.addInlet("b", {type:"audio"})
  this.addInlet("dial", {mono: true, min:0, max:1, zero:0.5})
  this.addOutlet("out", {type:"audio"})

  this.A = a || 0
  this.B = b || 0
  this.DIAL = dial || 0 // 0: all A, 1: all B
}
CrossFader.prototype = Object.create(Unit.prototype)
CrossFader.prototype.constructor = CrossFader
module.exports = CrossFader

const zeroChannel = new Float32Array(Unit.standardChunkSize).fill(0)

CrossFader.prototype._tick = function() {
  for(var c=0; c<this.a.length || c<this.b.length; c++) {
    var aChannel = this.a[c] || zeroChannel
    var bChannel = this.b[c] || zeroChannel
    this.out[c] = this.out[c] || new Float32Array(aChannel.length)
    for(var t=0; t<aChannel.length; t++) {
      this.out[c][t] = (1-this.dial[t])*aChannel[t] + this.dial[t] * bChannel[t]
    }
  }
}
