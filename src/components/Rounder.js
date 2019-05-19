const Unit = require('../Unit')

class Rounder extends Unit {
  constructor(stepSize=1, offset=0) {
    super()

    this.addInlet('in', {mono:true})
    this.addInlet('step', {mono:true})
    this.addInlet('offset', {mono:true})
    this.addOutlet('out', {mono:true})

    this.IN = 0
    this.STEP = stepSize
    this.OFFSET = offset
  }

  _tick() {
    for(let t=0; t<this.in.length; t++) {
      this.out[t] = Math.round(
        (this.in[t] - this.offset[t])/this.step[t]
      ) * this.step[t] + this.offset[t]
    }
  }
}
module.exports = Rounder
