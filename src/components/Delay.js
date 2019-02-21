const Unit = require("../Unit.js")
const config = require("../config.js")

const zeroChunk = new Float32Array(config.standardChunkSize).fill(0)

class Delay extends Unit {
  constructor(input, delay, maxDelay) {
    super()
    this.addInlet("in")
    this.addInlet("delay", {measuredIn:"samples"})
    this.addOutlet("out")

    this.maxDelay = maxDelay || Unit.sampleRate * 5
    this.buffers = [new Float32Array(this.maxDelay)]

    this.IN = input || 0
    this.DELAY = delay || 4410
  }

  _tick(clock) {
    for(var c=0; c<this.in.length || c<this.delay.length; c++) {
      this.out[c] = this.out[c] || new Float32Array(this.OUT.chunkSize)
      this.in[c] = this.in[c%this.in.length]
      this.buffers[c] = this.buffers[c] || new Float32Array(this.maxDelay)
      var delayChunk = this.delay[c%this.delay.length]
      for(var t=0; t<this.in[c].length; t++) {
        var tBuffer = (clock + t)%this.buffers[c].length
        this.out[c][t] = this.buffers[c][tBuffer]
        this.buffers[c][tBuffer] = 0
        /*if(this.delay[c][t] >= this.buffers[c].length)
          console.log(
            this.label+":", "delay time exceded buffer size by",
            delayChunk[t]-this.buffers[c].length+1,
            "samples (channel: " + c + ")"
          )*/
        var tWrite = (tBuffer + delayChunk[t])%this.buffers[c].length
        this.buffers[c][Math.floor(tWrite)] += this.in[c][t] * (1-tWrite%1)
        this.buffers[c][Math.ceil(tWrite)] += this.in[c][t] * (tWrite%1)
      }
    }
  }
}
module.exports = Delay
