/*
  Circuit
  The Circuit class is responsibible for executing a Unit objects in the correct
  order and moving data between them.
*/

const gcd = require("compute-gcd")
const Promise = require("promise")
const explore = require('./explore')

function Circuit(...units) {
  this.units = [] // NOTE: units will be executed in the order of this array
  this.centralUnits = null
  this.tickIntervals = []
  this.clock = 0
  this.events = []
  this.promises = []

  this.keepTicking = false

  for(var unit of units)
    this.add(unit)
}
module.exports = Circuit

Circuit.prototype.tick = async function() {
  // process one chunk of data

  // execute any events which are due
  this.runEvents(this.clock + this.gcdTickInterval)

  // await promises, if they exist
  if(this.promises.length > 0) {
    console.log("waiting for", this.promises.length, "promises")
    var cake = await Promise.all(this.promises)
    console.log("promises fulfilled!")
    this.promises = []
  }

  // turn midcycle flag on
  this.midcycle = true

  // call tick on each unit in order
  for(var i=0; i<this.units.length; i++)
    if(this.clock%this.units[i].tickInterval == 0)
      this.units[i].tick(this.clock)

  // increment clock, turn midcycle flag off
  this.clock += this.gcdTickInterval
  this.midcycle = false
}
Circuit.prototype.tickUntil = async function(t) {
  // call tick until a certain clock value
  while(this.clock < t)
    await this.tick()
}
Circuit.prototype.startTicking = async function() {
  // begin processing continuously until stopTicking is called
  this.keepTicking = true

  while(this.keepTicking)
    await this.tick()
}
Circuit.prototype.stopTicking = function() {
  // stop processing continously
  this.keepTicking = false
}

Circuit.prototype.runEvents = function(beforeT) {
  // execute all due events
  beforeT = beforeT || this.clock
  var followUps = []
  while(this.events[0] && this.events[0].t < beforeT) {
    var followUpEvent = this.events.shift().run()
    if(followUpEvent)
      this.addEvent(followUpEvent)
  }
}

Circuit.prototype.add = function(unit) {
  // add a unit to the circuit

  // throw an error if unit belongs to another circuit
  if(unit.circuit && unit.circuit != this)
    throw "circuit clash, oh god " + unit.label + "\n"+(unit.circuit == this)

  // exit early if unit already belongs to this circuit
  if(this.units.includes(unit))
    return null;

  // add unit to list
  this.units.push(unit)

  // set units circuit to this
  unit.circuit = this

  // add units tick interval to list
  if(!this.tickIntervals.includes(unit.tickInterval)) {
    this.tickIntervals.push(unit.tickInterval)
    this.tickIntervals = this.tickIntervals.sort((a,b) => {return a-b})
  }

  // appropriate unit's events
  if(unit.events) {
    for(var i in unit.events)
      this.addEvent(unit.events[i])
    unit.events = null  // from now on events will be redirected to the circuit
  }

  // appropriate unit's promises
  if(unit.promises) {
    for(var i in unit.promises)
      this.addPromise(unit.promises[i])
    unit.promises = null
    // from now on promises will be redirected to the circuit
  }

  // recursively add any other units connected to the unit
  var inputUnits = unit.inputUnits
  for(var i in inputUnits)
    this.add(inputUnits[i])
  var outputUnits = unit.outputUnits
  for(var i in outputUnits)
    this.add(outputUnits[i])

  // calculate the units process index
  unit.computeProcessIndex()

  // sort circuit's units
  this.computeOrders()

  // return true if successful
  return true
}

Circuit.prototype.remove = function(...toRemove) {
  // remove a set of units from the circuit
  for(let u of toRemove)
    console.log('removing', u.label, 'from circuit')

  // Throw an error if any of the units are connected to any units which aren't
  // to be removed.
  for(let unit of toRemove)
    for(let neighbour of unit.neighbours)
      if(!toRemove.includes(neighbour))
        throw 'cannot remove ' + unit.label +
          ' from circuit because it is connected to ' + neighbour.label

  // set the circuit and process index of the outgoing units to null
  for(let unit of toRemove) {
    unit.circuit = null
    unit.processIndex = undefined
  }

  // remove units from circuit's unit list
  this.units = this.units.filter(unit => !toRemove.includes(unit))

  // recalculate all process index values
  this.recomputeProcessIndexs() // TODO: implement this function

  // sort unit list and recalculate gcd tick interval
  this.computeOrders()

  // remove events which belong to the outgoing units
  this.events = this.events.filter(e => !toRemove.includes(e.unit))
}

Circuit.prototype.removeRecursively = function(...units) {
  let toRemove = explore.all(...units)
  this.remove(...toRemove)
}

Circuit.prototype.checkConnected = function(unit) {
  // check if there is a connection between a given unit and any central unit
  if(!this.centralUnits)
    return true

  return explore.checkConnection(unit, ...this.centralUnits)
}

Circuit.prototype.removeRecursivelyIfDisconnected = function(unit) {
  if(!this.checkConnected(unit)) {
    this.removeRecursively(unit)
  }
}

Circuit.prototype.addEvent = function(eventToAdd) {
  // insert an event into this circuit's event register
  eventToAdd.circuit = this
  for(var i=0; i<this.events.length; i++) {
    if(eventToAdd.t < this.events[i].t) {
      this.events.splice(i, 0, eventToAdd)
      return ;
    }
  }

  // if we get here the new event must be after all others
  this.events.push(eventToAdd)
}
Circuit.prototype.addPromise = function(promise) {
  // add a promise to the circuit
  this.promises.push(promise)
}

Circuit.prototype.recomputeProcessIndexs = function() {
  // set process index of all units to `undefined`
  for(let unit of this.units)
    unit.processIndex = undefined

  // call compute process index for all units
  for(let unit of this.units)
  // I PREDICT A POSSIBLE BUG HERE: it doesn't take account of the starting point/rendering unit
    if(unit.processIndex == undefined)
      unit.computeProcessIndex()
}
Circuit.prototype.computeOrders = function() {
  // sort units by process index
  this.units = this.units.sort((a, b) => {
    return a.processIndex - b.processIndex
  })

  // calculate the underlying (GCD) tick interval for the circuit
  this.gcdTickInterval = this.tickIntervals[0]
  for(var i=1; i<this.tickIntervals.length; i++) {
    this.gcdTickInterval = gcd(this.gcdTickInterval, this.tickIntervals[i])
  }
  if(this.gcdTickInterval <= 16)
    console.warn("circuit gcdTickInterval is low:", this.gcdTickInterval, ", processing may be slow")

}

Circuit.prototype.findNaNCulprit = function() {
  // trace the origin of a NaN error within the circuit
  for(var i in this.units) {
    for(var j in this.units[i].inlets) {
      var inlet = this.units[i].inlets[j]
      var chunk = inlet.signalChunk.channelData
      for(var c in chunk)
        for(var t in chunk[c])
          if(isNaN(chunk[c][t]))
            return inlet
    }
    for(var j in this.units[i].outlets) {
      var outlet = this.units[i].outlets[j]
      var chunk = outlet.signalChunk.channelData
      for(var c in chunk)
        for(var t in chunk[c])
          if(isNaN(chunk[c][t]))
            return outlet
    }
  }
}

Circuit.prototype.__defineGetter__("lastUnit", function() {
  // return the last unit in this circuit's list
  return this.units[this.units.length-1]
})
Circuit.prototype.findUnit = function(label) {
  // find a unit with a given label or return null
  for(var i in this.units) {
    if(units[i].label = label)
      return units[i]
  }
  return null
}
