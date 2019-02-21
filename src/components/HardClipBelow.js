const Unit = require("../Unit.js")

class HardClipBelow extends Unit {
  constructor(input, threshold) {
    super()
    this.addInlet("in")
    this.addInlet("threshold")
    this.addOutlet("out")

    this.IN = input || 0
    this.THRESHOLD = threshold || 0
  }

  _tick() {
    for(var c=0; c<this.in.length; c++) {
      this.out[c] = this.out[c] || new Float32Array(this.OUT.chunkSize)
      var threshold = this.threshold[c%this.threshold.length]
      for(var t=0; t<this.in[c].length; t++)
        if(this.in[c][t] < threshold[t])
          this.out[c][t] = threshold[t]
        else
          this.out[c][t] = this.in[c][t]
    }
  }
}
module.exports = HardClipBelow
