const Unit = require("../../Unit.js")
const FFTjs = require("fft.js")

class FFT extends Unit {
  constructor(windowSize, hopSize) {
    super()
    if(!windowSize)
      throw "FFT expects window size"

    this.windowSize = windowSize
    this.frameSize = this.windowSize * 2

    this.tickInterval = hopSize
    this.addInlet("in", {chunkSize:windowSize})
    this.addOutlet("out", {chunkSize: this.frameSize, type:"spectral"})
    this.fft = new FFTjs(this.windowSize)
  }

  _tick() {
    for(var c in this.in) {
      this.out[c] = this.out[c] || new Array(this.windowSize*2)
      this.fft.realTransform(this.out[c], this.in[c])
      this.fft.completeSpectrum(this.out[c])
    }
  }
}
module.exports = FFT
