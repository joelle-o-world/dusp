const Unit = require("../Unit.js")

function MonoDelay(input, delay) {
  Unit.call(this)
  this.addInlet("in", {mono: true, type:"audio"})
  this.addInlet("delay", {mono: true, measuredIn: "samples"})
  this.addOutlet("out", {mono: true, type:"audio"})

  this.maxDelay = Unit.sampleRate * 5
  this.buffer = new Float32Array(this.maxDelay)

  this.IN = input || 0
  this.DELAY = delay || 4410
}
MonoDelay.prototype = Object.create(Unit.prototype)
MonoDelay.prototype.constructor = MonoDelay
module.exports = MonoDelay

MonoDelay.prototype._tick = function(clock) {
  for(var t=0; t<this.in.length; t++) {
    var tBuffer = (clock + t)%this.buffer.length
    if(this.delay[t] >= this.buffer.length)
      console.log(this.label+":", "delay time exceded buffer size by", this.delay[t]-this.buffer.length+1, "samples")
    var tWrite = (tBuffer + this.delay[t])%this.buffer.length
    this.buffer[Math.floor(tWrite)] += this.in[t] * (1-tWrite%1)
    this.buffer[Math.ceil(tWrite)%this.buffer.length] += this.in[t] * (tWrite%1)
    this.out[t] = this.buffer[tBuffer]
    this.buffer[tBuffer] = 0
  }
}
