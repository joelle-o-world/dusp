import UnitOrPatch from "./UnitOrPatch.js"
import config from "./config.js"
import Outlet from "./Outlet.js"
import Inlet from "./Inlet.js"
import Circuit from "./Circuit"

class Unit extends UnitOrPatch {
  constructor() {
    UnitOrPatch.call(this)

    this.inlets = {}
    this.inletsOrdered = []
    this.outlets = {}
    this.outletsOrdered = []

    this.events = []
    this.promises = []

    this.clock = 0
    this.tickInterval = Unit.standardChunkSize

    this.finished = false

    this.nChains = 0
    this.afterChains = []
    this.beforeChains = []

    this.constructor.timesUsed = (this.constructor.timesUsed || 0) + 1
    this.giveUniqueLabel()
  }

  get isUnit() {
    return true;
  }

  get sampleRate() {
    return config.sampleRate
  }
  get samplePeriod() {
    return 1/config.sampleRate
  }

  giveUniqueLabel() {
    if(!this.label)
      this.label = this.constructor.name + this.constructor.timesUsed
    return this.label
  }

  addInlet(name, options) {
    options = options || {}
    options.name = name
    options.unit = this

    var inlet = new Inlet(options)
    this.inlets[name] = inlet
    this.inletsOrdered.push(inlet)
    this.__defineGetter__(name.toUpperCase(), function() {
      return inlet
    })
    this.__defineSetter__(name.toUpperCase(), function(val) {
      if(val == undefined)
        throw "Passed bad value to " + inlet.label

      if(val.constructor == Number || val.constructor == Array)
        inlet.setConstant(val)
      if(val.isOutlet || val.isUnit || val.isPatch)
        inlet.connect(val)
    })

    inlet.exposeDataToUnit()

    return inlet
  }
  addOutlet(name, options) {
    options = options || {}
    options.name = name
    options.unit = this
    var outlet = new Outlet(options)

    outlet.exposeDataToUnit()

    this.outlets[name] = outlet
    this[name.toUpperCase()] = outlet
    this.outletsOrdered.push(outlet)

    return outlet
  }

  chainAfter(unit) {
    if(!unit.isUnit)
      throw "chainAfter expects a Unit"
    this.addInlet(
      "chain"+(this.nChains++),
      {noData:true})
    .connect(
      unit.addOutlet("chain"+(unit.nChains++)),
      {noData: true}
    )
  }
  chain() {
    return this.chainAfter()
  }

  chainBefore(unit) {
    if(!unit.isUnit)
      throw "chainBefore expects a Unit"
    return unit.chainAfter(this)
  }

  unChain(objectToUnchain) {
    // to do
    console.warn("TODO: Unit.prototype.unchain()")
  }

  tick(clock0) {
    this.clock = clock0
    if(this._tick)
      this._tick(clock0)
    this.clock = clock0 + this.tickInterval
    for(var i in this.outlets) // used for renderStream
      if(this.outlets[i].onTick)
        this.outlets[i].onTick()
  }

get inputUnits() {
  var list = []
  for(var i in this.inlets) {
    if(!this.inlets[i].connected)
      continue

    var unit = this.inlets[i].outlet.unit
    if(list.indexOf(unit) == -1)
      list.push(unit)
  }
  return list
}
  get outputUnits() {
    var list = []
    for(var i in this.outlets) {
      for(var j in this.outlets[i].connections) {
        var unit = this.outlets[i].connections[j].unit
        if(list.indexOf(unit) == -1)
          list.push(unit)
      }
    }
    return list
  }
  get numberOfOutgoingConnections() {
    var n = 0
    for(var name in this.outlets)
      n += this.outlets[name].connections
    return n
  }
  get neighbours() {
    var inputs = this.inputUnits
    var outputs = this.outputUnits
      .filter(item => (inputs.indexOf(item) == -1))
    return inputs.concat(outputs)
  }

  randomInlet() {
    return this.inletsOrdered[Math.floor(Math.random()*this.inletsOrdered.length)]
  }
  randomOutlet() {
    return this.outletsOrdered[Math.floor(Math.random()*this.outletsOrdered.length)]
  }

  get printInputUnits() {
    return this.inputUnits.map((unit)=>{return unit.label}).join(", ")
  }
  get printOutputUnits() {
    return this.outputUnits.map((unit) =>{return unit.label}).join(", ")
  }

  computeProcessIndex(history) {

    // NOTE: adding comments in 2021 to better understand this spaghetti.

    // Create a new history with `this` appended
    history = (history || []).concat([this])

    // Find input units that do not occur in history.
    var inputUnits = this.inputUnits.filter((unit) => {
      return (history.indexOf(unit) == -1)
    })

    // Find the maximum processing index of this units dependencies
    var max = -1
    for(var i in inputUnits) {
      // Is dependency has no assigned process index, recursively compute it
      if(inputUnits[i].processIndex == undefined)
        inputUnits[i].computeProcessIndex(history)
      if(inputUnits[i].processIndex > max)
        max = inputUnits[i].processIndex
    }

    // Assign process index
    this.processIndex = max + 1

    var outputUnits = this.outputUnits.filter((unit) => {
      return (history.indexOf(unit) == -1)
    }) // this filter is unnessecary (won't change now thought just in case)

    // Compute process indexes of dependent units (where they are not already computed)
    for(var i in outputUnits) {
      if(outputUnits[i].processIndex == undefined ||
        outputUnits[i].processIndex <= this.processIndex) {
        outputUnits[i].computeProcessIndex(history)
      }
    }

    return this.processIndex
  }

  computeStepsToNecessity(history) {
    console.log("NO IDEA IF THIS WORKS!") // Lol! (2021)
    if(this.stepsToNecessity === 1)
      return 1

    history = (history || []).concat([this])
    var neighbours = this.neighbours.filter(unit => (history.indexOf(unit) == -1))

    if(this.stepsToNecessity == undefined) {
      var winner = Infinity
      for(var i in neighbours) {
        if(neighbours[i].stepsToNecessity == undefined)
          neighbours[i].computeStepsToNecessity(history)
        if(neighbours[i].stepsToNecessity && neighbours[i].stepsToNecessity < winner)
          winner = neighbours[i].stepsToNecessity
      }
      if(winner != Infinity)
        return this.stepsToNecessity = winner + 1
      else
        return this.stepsToNecessity = null

    } else {

      var oldScore = this.stepsToNecessity
      this.stepsToNecessity = undefined
      var winner = Infinity
      for(var i in neighbours) {
        neighbours[i].computeStepsToNecessity(history)
        if(neighbours[i].stepsToNecessity !== null && neighbours[i].stepsToNecessity < winner)
          winner = neighbours[i].stepsToNecessity
      }
      if(winner != Infinity)
        return this.stepsToNecessity = winner + 1
      else
        return this.stepsToNecessity = null
    }
  }
  markAsNecessary() {
    this.stepsToNecessity = 1
  }

  get defaultInlet() {
    return this.inletsOrdered[0]
  }
  get defaultOutlet() {
    return this.outletsOrdered[0]
  }
  get topInlet() {
    var inlet = this.defaultInlet
    if(inlet.connected)
      return inlet.outlet.unit.topInlet
    else return inlet
  }


  addEvent(newEvent) {
    if(this.circuit)
      this.circuit.addEvent(newEvent)
    else {
      for(var i=0; i<this.events.length; i++)
        if(newEvent.t < this.events[i].t) {
          this.events.splice(i, 0, newEvent)
          return ;
        }
      // if we get here the new event must be after all others
      this.events.push(newEvent)
    }
  }


  addPromise(promise) {
    if(this.circuit)
      this.circuit.addPromise(promise)
    else
      this.promises.push(promise)
  }

  getOrBuildCircuit() {
    if(this.circuit)
      return this.circuit
    else
      return new Circuit(this)
  }

  trigger() {
    var inputUnits = this.inputUnits
    for(var i in inputUnits)
      inputUnits[i].trigger()
  }
  stop() {
    var inputUnits = this.inputUnits
    for(var i in inputUnits)
      inputUnits[i].stop()
  }

}

Unit.sampleRate = config.sampleRate
Unit.samplePeriod = 1/config.sampleRate
Unit.standardChunkSize = config.standardChunkSize

export default Unit
