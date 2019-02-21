const SpectralUnit = require("./SpectralUnit.js")

class BinShift extends SpectralUnit {
  constructor(shift) {
    super()

    this.addSpectralInlet("in")
    this.addInlet("shift", {mono: true})
    this.addSpectralOutlet("out")

    this.SHIFT = shift || 0
  }

  _tick() {
    var shift = Math.round(this.shift[0]) * 2
    for(var c in this.in) {
      var out = this.out[c] = this.out[c] || new Array(this.frameSize).fill(0)
      out.fill(0)
      for(var bin=1; bin<this.frameSize && bin+shift < this.frameSize; bin+=2) {
        if(bin+shift < 0)
          continue
        out[bin+shift] = this.in[c][bin]
        out[bin+shift-1] = this.in[c][bin-1]
      }
    }
  }
}
module.exports = BinShift
