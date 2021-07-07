import Unit from "../Unit.js"
import config from "../config.js"

const zeroChunk = new Float32Array(config.standardChunkSize).fill(0)

class Subtract extends Unit {
  constructor(A, B) {
    super()
    this.addInlet("a")
    this.addInlet("b")
    this.addOutlet("out")

    this.A = A || 0
    this.B = B || 0
  }


  _tick() {
    for(var c=0; c<this.a.length || c<this.b.length; c++) {
      if(!this.out[c])
        this.out[c] = new Float32Array(this.OUT.chunkSize)
      var aChunk = this.a[c] || zeroChunk
      var bChunk = this.b[c] || zeroChunk
      for(var t=0; t<aChunk.length; t++) {
        this.out[c][t] = aChunk[t] - bChunk[t]
      }
    }
  }
}
export default Subtract
