const UnitOrPatch = require("./UnitOrPatch.js")
const config = require("./config.js")
const Outlet = require("./Outlet.js")
const Inlet = require("./Inlet.js")
const Circuit = require("./Circuit")

function Unit() {
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
Unit.prototype = Object.create(UnitOrPatch.prototype)
Unit.prototype.constructor = Unit
module.exports = Unit

Unit.sampleRate = config.sampleRate
Unit.samplePeriod = 1/config.sampleRate
Unit.standardChunkSize = config.standardChunkSize

Unit.prototype.isUnit = true
Unit.prototype.sampleRate = config.sampleRate
Unit.prototype.samplePeriod = 1/config.sampleRate

Unit.prototype.giveUniqueLabel = function() {
  if(!this.label)
    this.label = this.constructor.name + this.constructor.timesUsed
  return this.label
}

Unit.prototype.addInlet = function(name, options) {
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
Unit.prototype.addOutlet = function(name, options) {
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

Unit.prototype.chainAfter = function(unit) {
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
Unit.prototype.chain = Unit.prototype.chainAfter

Unit.prototype.chainBefore = function(unit) {
  if(!unit.isUnit)
    throw "chainBefore expects a Unit"
  return unit.chainAfter(this)
}
Unit.prototype.unChain = function(objectToUnchain) {
  // to do
  console.warn("TODO: Unit.prototype.unchain()")
}

Unit.prototype.tick = function(clock0) {
  this.clock = clock0
  if(this._tick)
    this._tick(clock0)
  this.clock = clock0 + this.tickInterval
  for(var i in this.outlets) // used for renderStream
    if(this.outlets[i].onTick)
      this.outlets[i].onTick()
}

Unit.prototype.__defineGetter__("inputUnits", function() {
  var list = []
  for(var i in this.inlets) {
    if(!this.inlets[i].connected)
      continue

    var unit = this.inlets[i].outlet.unit
    if(list.indexOf(unit) == -1)
      list.push(unit)
  }
  return list
})
Unit.prototype.__defineGetter__("outputUnits", function() {
  var list = []
  for(var i in this.outlets) {
    for(var j in this.outlets[i].connections) {
      var unit = this.outlets[i].connections[j].unit
      if(list.indexOf(unit) == -1)
        list.push(unit)
    }
  }
  return list
})
Unit.prototype.__defineGetter__("numberOfOutgoingConnections", function() {
  var n = 0
  for(var name in this.outlets)
    n += this.outlets[name].connections
  return n
})
Unit.prototype.__defineGetter__("neighbours", function() {
  var inputs = this.inputUnits
  var outputs = this.outputUnits
    .filter(item => (inputs.indexOf(item) == -1))
  return inputs.concat(outputs)
})

Unit.prototype.randomInlet = function() {
  return this.inletsOrdered[Math.floor(Math.random()*this.inletsOrdered.length)]
}
Unit.prototype.randomOutlet = function() {
  return this.outletsOrdered[Math.floor(Math.random()*this.outletsOrdered.length)]
}

Unit.prototype.__defineGetter__("printInputUnits", function() {
  return this.inputUnits.map((unit)=>{return unit.label}).join(", ")
})
Unit.prototype.__defineGetter__("printOutputUnits", function() {
  return this.outputUnits.map((unit) =>{return unit.label}).join(", ")
})

Unit.prototype.computeProcessIndex = function(history) {
  history = (history || []).concat([this])

  var inputUnits = this.inputUnits.filter((unit) => {
    return (history.indexOf(unit) == -1)
  })

  var max = -1
  for(var i in inputUnits) {
    if(inputUnits[i].processIndex == undefined)
      inputUnits[i].computeProcessIndex(history)
    if(inputUnits[i].processIndex > max)
      max = inputUnits[i].processIndex
  }

  this.processIndex = max + 1

  var outputUnits = this.outputUnits.filter((unit) => {
    return (history.indexOf(unit) == -1)
  })
  for(var i in outputUnits) {
    if(outputUnits[i].processIndex == undefined ||
      outputUnits[i].processIndex <= this.processIndex) {
      outputUnits[i].computeProcessIndex(history)
    }
  }

  return this.processIndex
}

Unit.prototype.computeStepsToNecessity = function(history) {
  console.log("NO IDEA IF THIS WORKS!")
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
Unit.prototype.markAsNecessary = function() {
  this.stepsToNecessity = 1
}

Unit.prototype.__defineGetter__("defaultInlet", function() {
  return this.inletsOrdered[0]
})
Unit.prototype.__defineGetter__("defaultOutlet", function() {
  return this.outletsOrdered[0]
})
Unit.prototype.__defineGetter__("topInlet", function() {
  var inlet = this.defaultInlet
  if(inlet.connected)
    return inlet.outlet.unit.topInlet
  else return inlet
})


Unit.prototype.addEvent = function(newEvent) {
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


Unit.prototype.addPromise = function(promise) {
  if(this.circuit)
    this.circuit.addPromise(promise)
  else
    this.promises.push(promise)
}

Unit.prototype.getOrBuildCircuit = function() {
  if(this.circuit)
    return this.circuit
  else
    return new Circuit(this)
}

Unit.prototype.trigger = function() {
  var inputUnits = this.inputUnits
  for(var i in inputUnits)
    inputUnits[i].trigger()
}
Unit.prototype.stop = function() {
  var inputUnits = this.inputUnits
  for(var i in inputUnits)
    inputUnits[i].stop()
}
