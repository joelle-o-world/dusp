const Patimport from "../Patch"
import Mixer from "./Mixer"

class TriggerGroup extends Patch {
  constructor() {
    super()

    this.addUnits(
      this.mixer = new Mixer()
    )
    this.triggers = {}

    this.aliasOutlet(this.mixer.OUT)
  }

  addTrigger(trigger, name) {
    if(name == undefined) {
      name = 0
      while(this.triggers[name] != undefined)
        name++
    }
    this.triggers[name] = trigger
    this.mixer.addInput(trigger)
  }

  trigger(which) {
    if(this.triggers[which])
      this.triggers[which].trigger()
    else if(this.handleUnknownTrigger)
      this.handleUnknownTrigger(which)
    else
      console.log(this.label, "unknown trigger:", which)
  }
}
export default TriggerGroup
