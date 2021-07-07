import Unit from "../../Unit.js"

class UnHopper extends Unit {
  constructor(hopSize, windowSize) {
    super()

    this.windowSize = windowSize
    this.hopSize = hopSize

    this.tickInterval = hopSize

    this.addInlet("in", {chunkSize: this.windowSize})
    this.addOutlet("out", {chunkSize: this.hopSize})

    this.buffer = [] // multichannel circular buffer
    this.t = 0
  }

  _tick() {
    // mix input to buffer
    for(var c=0; c<this.in.length; c++) {
      var buffer = this.buffer[c] = this.buffer[c] || new Array(this.windowSize).fill(0)
      for(var t=0; t<this.windowSize; t++) {
        buffer[(t+this.t)%buffer.length] += this.in[c][t]
      }
    }
    this.t += this.hopSize

    // copy from buffer to output
    if(this.t > this.hopSize) {
      var t0 = (this.t-this.hopSize)
      var tBuffer
      for(var c=0; c<this.buffer.length; c++) {
        var out = this.out[c] = this.out[c] || new Array(this.hopSize)
        var buffer = this.buffer[c]
        for(var t=0; t<this.hopSize; t++) {
          tBuffer = (t0+t)%buffer.length
          out[t] = buffer[tBuffer]
          // wipe copied part of the buffer
          buffer[tBuffer] = 0
        }
      }
    }
  }
}
export default UnHopper
