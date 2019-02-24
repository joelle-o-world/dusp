const Patch = require("../Patch.js")

class Synth extends Patch {
  constructor() {
    super()

    this.triggerList = []
  }

  trigger(p, note) {
    if(this._trigger)
      this._trigger(p, note)

    if(this.triggerList)
      for(var i in this.triggerList)
        this.triggerList[i].trigger()

    return this
  }

  addEnvelope(env) {
    if(env.isOutlet)
      env = env.unit
    this.triggerList.push(env)
    return env
  }
}
module.exports = Synth
