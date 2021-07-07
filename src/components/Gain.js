const Unit = require("../Unit.js")

class Gain extends Unit {
  constructor(gain) {
    super()
    this.addInlet("in")
    this.addInlet("gain", {mono: true, measuredIn: "dB"})
    this.addOutlet("out")

    this.GAIN = gain || 0
  }

  get isGain() {
    return true
  }

  _tick() {
    for(var c=0; c<this.in.length; c++) {
      if(this.out[c] == undefined)
        this.out[c] = new Float32Array(this.OUT.chunkSize)
      for(var t=0; t<Unit.standardChunkSize; t++)
        this.out[c][t] = dB(this.gain[t]) * this.in[c][t]
    }
  }
}
export default Gain

function dB(db) { // decibel to scale factor (for amplitude calculations)
  return Math.pow(10, db/20);
}
