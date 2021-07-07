import Unit from "../Unit.js"

class Monitor extends Unit {
  constructor(input) {
    super()
    this.addInlet("in")

    this.IN = input
  }

  _tick() {
    console.log(this.in)
  }
}
export default Monitor
