const SpectralUnit = require("./SpectralUnit.js")

class Augment extends SpectralUnit {
  constructor(incrementMapping={1:1}, windowSize, hopInterval) {
    super()

    this.addSpectralInlet("in")
    this.addSpectralOutlet("out")

    this.incrementMapping = incrementMapping
  }

  _tick() {
    for(var c=0; c<this.in.length; c++) {
      var out = this.out[c] = this.out[c] || new Array(this.frameSize)
      out.fill(0)
      for(var bin=0; bin<this.windowSize; bin++) {
        for(var i in this.incrementMapping) {
          var bin2 = Math.round(bin*parseFloat(i))*2
          if(bin2 < 0 || bin2 >= this.frameSize)
            continue
          out[bin2] += this.in[c][bin*2] * this.incrementMapping[i]
          out[bin2+1] += this.in[c][bin*2+1] * this.incrementMapping[i]
        }
      }
    }
  }
}
module.exports = Augment
