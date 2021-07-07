import Unit from "../Unit.js"

// Does a pythagorus across channels

class VectorMagnitude extends Unit {
  constructor() {
    super()
    this.addInlet("in") // vector
    this.addOutlet("out", {mono: true})

    this.IN = [0,0]
  }

  _tick() {
    var chunkSize = this.IN.chunkSize
    var nC = this.in.length
    for(var t=0; t<chunkSize; t++) {
      var squareSum = 0
      for(var c=0; c<nC; c++) {
        var x = this.in[c][t]
        squareSum += x*x
      }
      this.out[t] = Math.sqrt(squareSum)
      //console.log(this.out[t], this.in[0][t], this.in[1][t])
    }
  }
}
export default VectorMagnitude
