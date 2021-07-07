import Unit from "../Unit.js"

class Repeater extends Unit {
  constructor(val, measuredIn) {
    super()
    this.addInlet("in", {measuredIn:measuredIn})
    this.addOutlet("out", {measuredIn:measuredIn})
    this.measuredIn = measuredIn

    this.IN = val || 0
  }

  get dusp() {
    return {
      extraArgs: function() {
        if(this.measuredIn)
          return ["\""+this.measuredIn+"\""]
        else return null
      }
    }
  }

  _tick() {
    for(var c=0; c<this.in.length; c++) {
      this.out[c] = this.out[c] || new Float32Array(this.in[c].length)

      for(var t=0; t<this.in[c].length; t++)
        this.out[c][t] = this.in[c][t]
    }
  }
}
export default Repeater
