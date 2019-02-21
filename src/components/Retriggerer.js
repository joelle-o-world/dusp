const Unit = require("../Unit.js")

class Retriggerer extends Unit {
  constructor(target, rate) {
    super()
    this.addInlet("rate", {mono:true, type:"frequency"})
    if(target)
      this.target = target
    this.t = 0
    this.RATE = rate || 1
  }

  _tick() {
    for(var t=0; t<this.rate.length; t++) {
      this.t += this.rate[t]
      if(this.t >= this.sampleRate) {
        if(this._target && this._target.trigger)
          this._target.trigger()
        this.t -= this.sampleRate
      }
    }
  }

  get target() {
    return this._target
  }
  set target(target) {
    if(this._target)
      this.unChain(target)
    if(target) {
      this._target = target
      this.chainBefore(target)
    }
  }
}
module.exports = Retriggerer
