import gcd from "compute-gcd"
import Promise from "promise"

class Circuit {
  constructor() {
    this.units = []
    this.vital = [] // a list of units which are needed
    this.tickIntervals = []
    this.clock = 0
    this.events = []
    this.promises = []

    this.keepTicking = false

    for(var i in arguments)
      this.add(arguments[i])
  }

  async tick() {

    //console.log("promises:", this.promises)

    this.runEvents(this.clock + this.gcdTickInterval)

    if(this.promises.length > 0) {
      console.log("waiting for", this.promises.length, "promises")
      var cake = await Promise.all(this.promises)
      console.log("promises fulfilled!")
      this.promises = []
    }

    this.midcycle = true

    for(var i=0; i<this.units.length; i++) {
      if(this.clock%this.units[i].tickInterval == 0)
        this.units[i].tick(this.clock)
    }

    this.clock += this.gcdTickInterval
    this.midcycle = false
  }
  async tickUntil(t) {
    while(this.clock < t) {
      await this.tick()
    //  console.log("baah")
    }
  }
  async startTicking() {
    this.keepTicking = true
    while(this.keepTicking)
      await this.tick()
  }
  stopTicking() {
    this.keepTicking = false
  }

  runEvents(beforeT) {
    beforeT = beforeT || this.clock
    var followUps = []
    while(this.events[0] && this.events[0].t < beforeT) {
      var followUpEvent = this.events.shift().run()
      if(followUpEvent)
        this.addEvent(followUpEvent)
    }
  }

  add(unit) {
    if(unit.circuit && unit.circuit != this)
      throw "circuit clash, oh god " + unit.label + "\n"+(unit.circuit == this)
    if(this.units.indexOf(unit) != -1)
      return null;

    //console.log("adding", unit.label, "to circuit\t", unit.promises)

    this.units.push(unit)
    unit.circuit = this
    if(this.tickIntervals.indexOf(unit.tickInterval) == -1) {
      this.tickIntervals.push(unit.tickInterval)
      this.tickIntervals = this.tickIntervals.sort((a,b) => {return a-b})
    }

    // events
    if(unit.events) {
      for(var i in unit.events)
        this.addEvent(unit.events[i])
      unit.events = null  // from now on events will be redirected to the circuit
    }
    // promises
    if(unit.promises) {
      for(var i in unit.promises)
        this.addPromise(unit.promises[i])
      unit.promises = null
      // from now on promises will be redirected to the circuit
    }

    var inputUnits = unit.inputUnits
    for(var i in inputUnits)
      this.add(inputUnits[i])
    var outputUnits = unit.outputUnits
    for(var i in outputUnits)
      this.add(outputUnits[i])

    unit.computeProcessIndex()
    this.computeOrders()

    return true
  }

  addEvent(eventToAdd) {
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
  addPromise(promise) {
    this.promises.push(promise)
  }

  computeOrders() {
    // Sort units by their process index
    this.units = this.units.sort((a, b) => {
    //  console.log(a.processIndex, b.processIndex)
      return a.processIndex - b.processIndex
    })

    // Group the units depending on thier tick interval
    this.processOrders = {}
    for(var i in this.tickIntervals) {
      var tickInterval = this.tickIntervals[i]
      this.processOrders[tickInterval] = this.units.filter((unit) => {
        return tickInterval%unit.tickInterval == 0
      })
    }
    this.gcdTickInterval = this.tickIntervals[0]
    for(var i=1; i<this.tickIntervals.length; i++) {
      this.gcdTickInterval = gcd(this.gcdTickInterval, this.tickIntervals[i])
    }
    if(this.gcdTickInterval <= 16)
      console.warn("circuit gcdTickInterval is low:", this.gcdTickInterval, ", processing may be slow")

    // This whole multiple tick intervals idea looks like a bad idea to me now in 2021!
  }

  /** Good for debugging */
  findNaNCulprit() {
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

  get print() {
    this.printAsArray.join("\n")
  }
  get printAsArray() {
    var units = []
    for(var i=0; i<this.units.length; i++)
      units[i] = this.units[i].print
    return units
      /*return this.units.map((unit) => {
        return unit.print
      })*/
  }

  get lastUnit() {
    return this.units[this.units.length-1]
  }
  findUnit(label) {
    for(var i in this.units) {
      if(units[i].label = label)
        return units[i]
    }
    return null
  }

  unconnectedInlets(matching) {
    matching = matching || {}
    var list = []
    for(var i in this.units) {
      for(var name in this.units[i].inlets) {
        var inlet = this.units[i].inlets[name]
        if(inlet.connected)
          continue
        var aMatch = true
        for(var prop in matching)
          if(matching[prop] != inlet[prop]){
            aMatch = false
            break
          }
        if(aMatch)
          list.push(inlet)
      }
    }
    return list
  }

  randomInlet() {
    var unit = this.units[Math.floor(Math.random() * this.units.length)]
    return unit.randomInlet()
  }
  randomOutlet() {
    var unit = this.units[Math.floor(Math.random() * this.units.length)]
    return unit.randomOutlet()
  }
}
export default Circuit
