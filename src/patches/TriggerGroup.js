const Patch = require("../Patch.js")
const Mixer = require("./Mixer.js")

function TriggerGroup() {
  Patch.call(this)

  this.addUnits(
    this.mixer = new Mixer()
  )
  this.triggers = {}

  this.aliasOutlet(this.mixer.OUT)
}
TriggerGroup.prototype = Object.create(Patch.prototype)
TriggerGroup.prototype.constructor = TriggerGroup
module.exports = TriggerGroup

TriggerGroup.prototype.addTrigger = function(trigger, name) {
  if(name == undefined) {
    name = 0
    while(this.triggers[name] != undefined)
      name++
  }
  this.triggers[name] = trigger
  this.mixer.addInput(trigger)
}

TriggerGroup.prototype.trigger = function(which) {
  if(this.triggers[which])
    this.triggers[which].trigger()
  else if(this.handleUnknownTrigger)
    this.handleUnknownTrigger(which)
  else
    console.log(this.label, "unknown trigger:", which)
}
