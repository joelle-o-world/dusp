import Unit from "../Unit.js"

class LessThan extends Unit {
  constructor(input, val) {
    super()
    Unit.call(this)
    this.addInlet("in", {mono: true})
    this.addInlet("val", {mono: true})
    this.addOutlet("out", "bool")

    this.IN = input || 0
    this.VAL = val || 0
  }

  _tick() {
    for(var t=0; t<this.in.length; t++) {
      this.out[t] = (this.in[t] < this.val[t])
    }
  }
}
export default LessThan
