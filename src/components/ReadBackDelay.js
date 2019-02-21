const Unit = require("../Unit.js")
const config = require("../config.js")

function ReadBackDelay(input, delay, bufferLength) {
  Unit.call(this)

  this.addInlet("in")
  this.addInlet("delay", {measuredIn:"samples"})
  this.addOutlet("out")

  this.buffer = []
  this.bufferLength = bufferLength || config.sampleRate
  this.tBuffer = 0 // write head time within buffer

  this.IN = input || 0
  this.DELAY = delay || 0
}
ReadBackDelay.prototype = Object.create(Unit.prototype)
ReadBackDelay.prototype.constructor = ReadBackDelay
module.exports = ReadBackDelay


ReadBackDelay.prototype._tick = function() {
  var t0 = this.tBuffer
  var t1 = t0 + this.tickInterval
  for(var c=0; c<this.in.length || c<this.delay.length; c++) {
    var input = this.in[c%this.in.length]
    var delay = this.delay[c%this.delay.length]
    var output = this.out[c] = this.out[c] || new Float32Array(this.OUT.chunkSize)
    var buffer = this.buffer[c] = this.buffer[c] || new Float32Array(this.bufferLength)

    var i = 0
    for(var t=t0; t<t1; t++) {
      if(delay[i] > this.bufferLength)
        throw "delay may not exceed buffer length ("+this.label+")"

      buffer[(t+buffer.length)%buffer.length] = input[i]
      output[i] = buffer[(t-delay[i] + buffer.length) % buffer.length]
      i++
    }
  }
  this.tBuffer = t1
}
