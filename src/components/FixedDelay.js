const Unit = require("../Unit.js")

class FixedDelay extends Unit {
  constructor(delayTime) {
    super()

    this.addInlet("in", {mono: true, type:"audio"})
    this.addOutlet("out", {mono: true, type:"audio"})

    this.setSeconds(delayTime)
    this.tBuffer = 0
  }

  _tick() {
    for(var t=0; t<this.in.length; t++) {
      this.tBuffer = (this.tBuffer+1)%this.buffer.length
      this.out[t] = this.buffer[this.tBuffer]
      this.buffer[this.tBuffer] = this.in[t]
    }
  }

  setDelayTime(tSamples) {
    if(!tSamples || tSamples < 0.5)
      throw "Cannot have fixed delay of length 0 samples"
    this.delayTimeInSamples = Math.round(tSamples)
    this.delayTimeInSeconds = tSamples/this.sampleRate
    this.buffer = new Float32Array(this.delayTimeInSamples)
  }

  setSeconds(duration) {
    this.setDelayTime(duration*this.sampleRate)
  }

  setFrequency(f) {
    this.setSeconds(1/f)
  }
}
module.exports = FixedDelay
