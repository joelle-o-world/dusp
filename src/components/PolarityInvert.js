import Unit from "../Unit.js"

class PolarityInvert extends Unit {
  constructor(input) {
    super()

    this.addInlet("in")
    this.addOutlet("out")

    this.IN = input || 0
  }

  _tick() {
    for(var c=0; c<this.in.length; c++) {
      this.out[c] = this.out[c] || new Float32Array(this.OUT.chunkSize)
      for(var t=0; t<this.in[c].length; t++) {
        this.out[c][t] = -this.in[c][t]
      }
    }
  }
}
export default PolarityInvert
