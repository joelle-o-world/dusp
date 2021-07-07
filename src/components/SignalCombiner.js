import Unit from "../Unit.js"

class SignalCombiner extends Unit {
  constructor(a, b) {
    super()

    this.addInlet("a")
    this.addInlet("b")
    this.addOutlet("out")

    this.A = a || 0
    this.B = b || 0
  }

  collapseA() {
    var outInlets = this.OUT.connections
    for(var i in outInlets) {
      outInlets[i].connect(this.A.outlet)
    }
    this.A.disconnect()
    this.B.disconnect()
  }
  collapseB() {
    var outInlets = this.OUT.connections
    for(var i in outInlets) {
    //  console.log(this.label +".collapseB,", outInlets[i].label, ".connect(", this.B.outlet.label, ")")
      outInlets[i].connect(this.B.outlet)
    }
    this.A.disconnect()
    this.B.disconnect()
  }
}
export default SignalCombiner
