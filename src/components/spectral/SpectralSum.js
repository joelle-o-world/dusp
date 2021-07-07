import SpectralUnit from "./SpectralUnit.js"

class SpectralSum extends SpectralUnit {
  constructor(a, b, windowSize, hopInterval) {
    super()

    this.addSpectralInlet("a")
    this.addSpectralInlet("b")
    this.addSpectralOutlet("out")

    this.A = a
    this.B = b
  }

  _tick() {
    var numberOfChannels = Math.max(this.a.length, this.b.length)
    for(var c=0; c<numberOfChannels; c++) {
      var a = this.a[c%this.a.length]
      var b = this.b[c%this.b.length]
      var out = this.out[c] = this.out[c] || new Array(this.frameSize)
      for(var bin=0; bin<this.frameSize; bin++)
        out[bin] = a[bin] + b[bin]
    }
  }
}
export default SpectralSum
