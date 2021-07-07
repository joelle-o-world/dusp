import Unit from "../Unit.js"

class Abs extends Unit {
  constructor(input) {
    super()

    this.addInlet("in")
    this.addOutlet("out")

    this.IN = input || 0
  }

  get isAbs() {
    return true
  }

  _tick() {
    for(var c=0; c<this.in.length; c++) {
      this.out[c] = this.out[c] || new Float32Array(Unit.standardChunkSize)
      for(var t=0; t<this.in[c].length; t++) {
        this.out[c][t] = Math.abs(this.in[c][t])
      }
    }
  }
}
export default Abs
