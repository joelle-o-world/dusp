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

  this.on('disconnection', from => {
    if(this.circuit)
      this.circuit.removeRecursivelyIfDisconnected(this)
  })
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
  // generate and store a unique label for this unit
  if(!this.label)
    this.label = this.constructor.name + this.constructor.timesUsed
  return this.label
}

Unit.prototype.addInlet = function(name, options) {
  // add an inlet to the unit
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
  // add an outlet to this unit
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
  // chain this unit so that it executes after a given unit
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
Unit.prototype.chain = Unit.prototype.chainAfter // ALIAS

Unit.prototype.chainBefore = function(unit) {
  // chain this unit so it excutes before a given unit
  if(!unit.isUnit)
    throw "chainBefore expects a Unit"
  return unit.chainAfter(this)
}
Unit.prototype.unChain = function(objectToUnchain) {
  // to do
  console.warn("TODO: Unit.prototype.unchain()")
}

Unit.prototype.tick = function(clock0) {
  // CALLED ONLY BY THE CIRCUIT. Process one chunk of signal.
  this.clock = clock0

  // call unit specific tick function
  if(this._tick)
    this._tick(clock0)

  this.clock = clock0 + this.tickInterval
  for(var i in this.outlets) // used for renderStream
    if(this.outlets[i].onTick)
      this.outlets[i].onTick()
}

Unit.prototype.__defineGetter__("inputUnits", function() {
  // return a list of all units which send signals to this unit
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
  // return a list of all units that this unit sends signals to
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

Unit.prototype.__defineGetter__("recursiveInputUnits", function() {
  let list = this.inputUnits
  for(let i=0; i<list.length; i++) {
    for(let unit of list[i].inputUnits){
      if(!list.includes(unit))
        list.push(unit)
    }
  }
  return list
})

Unit.prototype.__defineGetter__("numberOfOutgoingConnections", function() {
  // count the number of outgoing connections

  var n = 0
  for(var name in this.outlets)
    n += this.outlets[name].connections
  return n
})
Unit.prototype.__defineGetter__("neighbours", function() {
  // union of this unit's inputs and outputs
  var inputs = this.inputUnits
  var outputs = this.outputUnits
    .filter(item => (inputs.indexOf(item) == -1))
  return inputs.concat(outputs)
})

Unit.prototype.randomInlet = function() {
  // choose one of this unit's inlets at random
  return this.inletsOrdered[Math.floor(Math.random()*this.inletsOrdered.length)]
}
Unit.prototype.randomOutlet = function() {
  // choose one of this unit's outlets at random
  return this.outletsOrdered[Math.floor(Math.random()*this.outletsOrdered.length)]
}

Unit.prototype.__defineGetter__("printInputUnits", function() {
  // get a str list of the input units to this unit
  return this.inputUnits.map(unit => unit.label).join(", ")
})
Unit.prototype.__defineGetter__("printOutputUnits", function() {
  // get a str list of the output units to this unit
  return this.outputUnits.map(unit => unit.label).join(", ")
})

Unit.prototype.computeProcessIndex = function(history) {
  // calculate the process index of this unit

  // add this to the end of history trace
  history = [...(history || []), this]

  // get input units that haven't been checked already
  let inputUnits = this.inputUnits.filter(unit => !history.includes(unit))

  // calculate process index as the maximum of the process indexs of the input units plus 1
  var max = -1
  for(var i in inputUnits) {
    // calculate process index recursively for unknown units
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

Unit.prototype.__defineGetter__("defaultInlet", function() {
  // get the default (first-defined) inlet
  return this.inletsOrdered[0]
})
Unit.prototype.__defineGetter__("defaultOutlet", function() {
  // get the default (first-defined) outlet
  return this.outletsOrdered[0]
})
Unit.prototype.__defineGetter__("topInlet", function() {
  // follow default inlets up the graph and return the top-most inlet
  var inlet = this.defaultInlet
  if(inlet.connected)
    return inlet.outlet.unit.topInlet
  else return inlet
})
Unit.prototype.__defineGetter__('firstConnectedOutlet', function() {
  for(let outlet of this.outletsOrdered)
    if(outlet.connections.length)
      return outlet

  return null
})
Unit.prototype.__defineGetter__('firstFreeInlet', function() {
  for(let inlet of this.inletsOrdered) {
    if(!inlet.outlet)
      return inlet
  }
  return null
})


Unit.prototype.addEvent = function(newEvent) {
  // schedule an event to be called on this unit
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
  // add a promise which must be fulfilled before this unit can process further
  if(this.circuit)
    this.circuit.addPromise(promise)
  else
    this.promises.push(promise)
}

Unit.prototype.getOrBuildCircuit = function() {
  // return this unit's circuit, or create one
  if(this.circuit)
    return this.circuit
  else
    return new Circuit(this)
}

Unit.prototype.trigger = function() {
  // default 'trigger' behaviour implementation: trigger all input units
  var inputUnits = this.inputUnits
  for(var i in inputUnits)
    inputUnits[i].trigger()
}
Unit.prototype.stop = function() {
  // default 'stop' behaviour implementation: stop all input units
  var inputUnits = this.inputUnits
  for(var i in inputUnits)
    inputUnits[i].stop()
}

Unit.prototype.remove = function() {
  // remove self from circuit
  if(this.circuit)
    this.circuit.remove(this)
}
