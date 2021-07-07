import SpectralUnit from "./SpectralUnit.js"

class SpectralGate extends SpectralUnit {
  constructor(threshold) {
    super()
    this.addSpectralInlet("in")
    this.addInlet("threshold", {mono: true})
    this.addSpectralOutlet("out",)

    this.invert = true

    this.THRESHOLD = threshold || 0.5
  }

  _tick() {
    var threshold = this.threshold[0]
    for(var c in this.in) {
      var out = this.out[c] = this.out[c] || new Array(this.frameSize)
      for(var bin=0; bin<this.frameSize; bin+=2) {
        var re = this.in[c][bin]
        var im = this.in[c][bin+1]
        var mag = Math.sqrt(re*re + im*im)
        if(this.invert ? mag < threshold : mag > threshold) {
          out[bin] = re
          out[bin+1] = im
        } else {
          out[bin] = 0
          out[bin+1] = 0
        }
      }
    }
  }
}
export default SpectralGate
