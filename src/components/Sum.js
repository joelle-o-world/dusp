const SignalCombiner = require("./SignalCombiner.js")
const config = require("../config.js")
const dusp = require("../dusp")

function Sum(a, b) {
  SignalCombiner.call(this, a, b)
}
Sum.prototype = Object.create(SignalCombiner.prototype)
Sum.prototype.constructor = Sum
module.exports = Sum

Sum.prototype.dusp = {
  shorthand: function(index) {
    return "("+dusp(this.A, index) + " + " + dusp(this.B, index)+")"
  }
}

Sum.many = function(inputs) {
  if(inputs.length == 1) {
    return inputs[0]
  }
  var sums = []
  sums[0] = new Sum(inputs[0], inputs[1])

  for(var i=2; i<inputs.length; i++)
    sums[i-1] = new Sum(sums[i-2], inputs[i])

  return sums[sums.length-1]
}

const zeroChannel = new Float32Array(config.standardChunkSize).fill(0)

Sum.prototype._tick = function() {
  for(var channel=0;
      channel<this.a.length || channel<this.b.length;
      channel++) {
    var aChan = this.a[channel%this.a.length] || zeroChannel
    var bChan = this.b[channel%this.b.length] || zeroChannel
    var outChan = this.out[channel]
                = (this.out[channel] || new Float32Array(config.standardChunkSize))
    for(var t=0; t<aChan.length || t<bChan.length; t++)
      outChan[t] = aChan[t] + bChan[t]
  }
}
