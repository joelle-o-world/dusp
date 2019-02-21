const Unit = require("../../Unit.js")
const FFTjs = require("fft.js")

class IFFT extends Unit {
  constructor(windowSize, hopSize) {
    super()
    if(!windowSize)
      throw "IFFT constructor requires argument: windowSize"

    this.windowSize = windowSize
    this.frameSize = windowSize * 2
    this.fft = new FFTjs(this.windowSize)
    this.complexOut = new Array(this.frameSize) // buffer to  temporarily store complex output of ifft

    this.tickInterval = hopSize

    this.addInlet("in", {type:"spectral", chunkSize: this.frameSize})
    this.addOutlet("out", {chunkSize: this.windowSize})
  }

  _tick() {
    for(var c in this.in) {
      // make output buffer for channel if does not exist
      this.out[c] = this.out[c] || new Array(this.windowSize)

      // perform ifft
      this.fft.inverseTransform(this.complexOut, this.in[c])

      // discard imaginary part of the signal
      for(var t=0; t<this.out[c].length; t++)
        this.out[c][t] = this.complexOut[t*2]
    }
  }
}
module.exports = IFFT
