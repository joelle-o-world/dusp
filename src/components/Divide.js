import Unit from "../Unit.js"

class Divide extends Unit {
  constructor(a, b) {
    super()
    this.addInlet("a")
    this.addInlet("b")
    this.addOutlet("out")

    this.A = a || 1
    this.B = b || 1
  }

  _tick(clock) {
    var outData = this.out
    var chunkSize = this.OUT.chunkSize
    for(var c=0; c<this.a.length || c<this.b.length; c++) {
      var aChan = this.a[c%this.a.length]
      var bChan = this.b[c%this.b.length]
      var outChan = outData[c] = outData[c] || new Float32Array(chunkSize)
      for(var t=0; t<chunkSize; t++) {
        outChan[t] = aChan[t] / bChan[t]
      }
    }
  }
}
export default Divide
