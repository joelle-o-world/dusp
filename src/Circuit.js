/*
  Circuit
  The Circuit class is responsibible for executing a Unit objects in the correct
  order and moving data between them.
*/

const gcd = require("compute-gcd")
const Promise = require("promise")

function Circuit() {
  this.units = []
  //this.vital = [] // a list of units which are needed
  this.tickIntervals = []
  this.clock = 0
  this.events = []
  this.promises = []

  this.keepTicking = false

  for(var i in arguments)
    this.add(arguments[i])
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
