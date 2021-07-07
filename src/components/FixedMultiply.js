import Unit from "../Unit.js"

class FixedMultiply extends Unit {
  constructor(sf, input) {
    super()

    this.addInlet("in", {mono: true})
    this.addOutlet("out", {mono: true})

    this.sf = sf

    this.IN = input || 0
  }

  get isFixedMultiply() {
    return true
  }

  _tick() {
    for(var t=0; t<this.in.length; t++)
      this.out[t] = this.in[t] * this.sf
  }
}
export default FixedMultiply
