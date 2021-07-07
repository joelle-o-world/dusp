import Unit from "../Unit.js"

class SampleRateRedux extends Unit {
  constructor(input, ammount) {
    super()
    this.addInlet("in")
    this.addInlet("ammount", {mono: true})
    this.addOutlet("out")

    this.val = [0]
    this.timeSinceLastUpdate = Infinity


    this.IN = input || 0
    this.AMMOUNT = ammount || 0
  }

  _tick() {
    var chunkSize = this.OUT.chunkSize
    while(this.out.length < this.in.length)
      this.out.push( new Float32Array(chunkSize) )
    for(var t=0; t<chunkSize; t++) {
      this.timeSinceLastUpdate++
      if(this.timeSinceLastUpdate > this.ammount[t]) {
        this.val = []
        for(var c=0; c<this.in.length; c++)
          this.val[c] = this.in[c][t]
        this.timeSinceLastUpdate = 0
      }
      for(var c=0; c<this.val.length; c++) {
        this.out[c][t] = this.val[c]
      }
    }
  }
}
export default SampleRateRedux
