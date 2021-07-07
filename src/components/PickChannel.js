import Unit from "../Unit.js"

class PickChannel extends Unit {
  constructor(input, c) {
    super()
    this.addInlet("in")
    this.addInlet("c", {mono: true})
    this.addOutlet("out", {mono: true})

    this.IN = input || 0
    this.C = c || 0
  }

  _tick() {
    var chunkSize = this.OUT.chunkSize
    for(var t=0; t<chunkSize; t++) {
      this.out[t] = this.in[this.c[t] % this.in.length][t]
    }
  }
}
export default PickChannel
