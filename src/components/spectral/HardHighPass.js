/*
  Spectrally implemented high pass filter.
*/

const SpectralUnit = require("./SpectralUnit.js")

class HardHighPass extends SpectralUnit {
  constructor(f) {
    super()

    this.addSpectralInlet("in")
    this.addInlet("f", {mono:true, type:"frequency"})
    this.addSpectralOutlet("out")

    this.fPerBin = this.sampleRate/this.windowSize

    this.F = f
  }

  _tick() {
    var cutOff = Math.round(this.f[0] / this.fPerBin)*2

    for(var c=0; c<this.in.length; c++) {
      this.out[c] = this.out[c] || new Array(this.frameSize)

      for(var i=0; i<cutOff && i<this.frameSize; i++)
        this.out[c][i] = 0
      for(var i=cutOff; i<this.frameSize; i++)
        this.out[c][i] = this.in[c][i]
    }
  }
}
module.exports = HardHighPass
