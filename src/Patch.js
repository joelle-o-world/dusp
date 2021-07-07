// A class for the quick construction and connection of complex dsp structures
// A Patch is an object for overseeing the construction of a circuit or part of a circuit
import UnitOrPatch from "./UnitOrPatch.js"
import Event from "./Event.js"

class Patch extends UnitOrPatch {
  constructor() {
    UnitOrPatch.call(this)

    this.inlets = {}
    this.outlets = {}
    this.inletsOrdered = []
    this.outletsOrdered = []
    this.units = []

    this.constructor.timesUsed = (this.constructor.timesUsed || 0) + 1
    this.label = this.constructor.name + this.constructor.timesUsed
  }

  get isPatch() {
    return true
  }

  aliasInlet(inlet, name) {
    if(inlet.isUnit || inlet.isPatch)
      inlet = inlet.inletsOrdered[0]
    if(name == undefined) {
      name = inlet.name
      var n = 0
      while(this.inlets[name]) {
        n++
        name = inlet.name + n
      }
    }
    this.inlets[name] = inlet
    this.inletsOrdered.push(inlet)
    this.__defineGetter__(name.toUpperCase(), function() {
      return inlet.unit[inlet.name.toUpperCase()]
    })
    this.__defineSetter__(name.toUpperCase(), function(val) {
      inlet.unit[inlet.name.toUpperCase()] = val
    })
  }
  aliasOutlet(outlet, name) {
    if(outlet.isUnit || outlet.isPatch)
      outlet = outlet.defaultOutlet
    if(name == undefined) {
      name = outlet.name
      var n = 0
      while(this.outlets[name]) {
        n++
        name = outlet.name + n
      }
    }
    this.outlets[name] = outlet
    this.outletsOrdered.push(outlet)
    this.__defineGetter__(name.toUpperCase(), function() {
      return outlet.unit[outlet.name.toUpperCase()]
    })
    this.__defineSetter__(name.toUpperCase(), function(val) {
      outlet.unit[outlet.name.toUpperCase()] = val
    })
  }
  alias(piglet, name) {
    if(piglet.isInlet)
      this.aliasInlet(piglet, name)
    else if(piglet.isOutlet)
      this.aliasOutlet(piglet, name)
  }

  get defaultInlet() {
    return this.inletsOrdered[0]
  }
  get defaultOutlet() {
    return this.outletsOrdered[0]
  }

  addUnit(unit) {
    if(unit.isUnit) {
      this.units.push(unit)
      unit.ownerPatch = this
    } else if(unit.isPatch) {
      this.units.push(unit)
      unit.ownerPatch = this
    }
  }

  addUnits() {
    for(var i in arguments) {
      if(arguments[i].constructor == Array)
        for(var j in arguments[i])
          this.addUnit(arguments[i][j])
      else
        this.addUnit(arguments[i])
    }
  }



  addEvent(newEvent) {
    if(this.units[0])
      this.units[0].addEvent(newEvent)
    else
      throw "Could not add event as Patch posseses no units: " + this.label
  }

  addPromise(promise) {
    if(this.units[0])
      this.units[0].addPromise(promise)
    else
      throw "Could not add promise as Patch posseses no units: " + this.label
  }

  trigger() {
    for(var i in this.units)
      if(this.units[i].trigger)
        this.units[i].trigger()
    return this
  }
}
export default Patch
