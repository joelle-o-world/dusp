import Unit from "../Unit.js"

class SporadicRetriggerer extends Unit {
  constructor(target, rate) {
    super()
    this.addInlet("rate", {mono:true, type:"frequency"})
    if(target)
      this.target = target
    this.RATE = rate || 1
  }

  _tick() {
    if(this._target && this._target.trigger)
      if(Math.random() < this.rate[0] * this.tickInterval / this.sampleRate)
        this._target.trigger()
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
export default SporadicRetriggerer
