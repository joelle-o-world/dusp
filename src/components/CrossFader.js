import Unit from "../Unit.js"

const zeroChannel = new Float32Array(Unit.standardChunkSize).fill(0)

class CrossFader extends Unit {
  constructor(a, b, dial) {
    super()
    this.addInlet("a", {type:"audio"})
    this.addInlet("b", {type:"audio"})
    this.addInlet("dial", {mono: true, min:0, max:1, zero:0.5})
    this.addOutlet("out", {type:"audio"})

    this.A = a || 0
    this.B = b || 0
    this.DIAL = dial || 0 // 0: all A, 1: all B
  }


  _tick() {
    for(var c=0; c<this.a.length || c<this.b.length; c++) {
      var aChannel = this.a[c] || zeroChannel
      var bChannel = this.b[c] || zeroChannel
      this.out[c] = this.out[c] || new Float32Array(aChannel.length)
      for(var t=0; t<aChannel.length; t++) {
        this.out[c][t] = (1-this.dial[t])*aChannel[t] + this.dial[t] * bChannel[t]
      }
    }
  }
}
export default CrossFader
