const Piglet = require("./Piglet.js")
const SignalChunk = require("./SignalChunk.js")

/** Used by Unit objects to recieve signals. */
class Inlet extends Piglet {
  constructor(model) {
    super(model)

    this.outlet = null
    this.constant = 0
  }

  disconnect() {
    if(this.outlet) {
      let outlet = this.outlet
      this.outlet.connections.splice(this.outlet.connections.indexOf(this), 1)
      this.outlet = null
      this.signalChunk = new SignalChunk(this.numberOfChannels, this.chunkSize)
      this.exposeDataToUnit()
      this.connected = false

      // emit unit events
      this.unit.emit('disconnection', outlet.unit)
      outlet.unit.emit('disconnection', this.unit)
      this.emit('disconnect', outlet)
      this.emit('change')
      outlet.emit('disconnect', this)
      outlet.emit('change')
    }
  }

  set(val) {
    if(val && val.isUnit || val.isOutlet || val.isPatch)
      this.connect(val)
    else
      this.setConstant(val)
  }

  get() {
    if(this.connected)
      return this.outlet
    else
      return this.constant
  }

  connect(outlet) {
    if(outlet == undefined)
      console.warn('WARNING: connecting', this.label, "to undefined")
    if(outlet.isUnit || outlet.isPatch)
      outlet = outlet.defaultOutlet
    if(this.connected)
      this.disconnect()
    this.connected = true

    if(this.chunkSize != outlet.chunkSize)
      console.warn("Inlet/Outlet chunkSize mismatch!", outlet.label, "->", this.label)

    this.outlet = outlet
    outlet.connections.push(this)
    this.signalChunk = outlet.signalChunk
    this.exposeDataToUnit()

    if(this.unit.circuit && outlet.unit.circuit && this.unit.circuit != outlet.unit.circuit)
      throw "SHIT: Circuit conflict"

    var modifiedCircuit = null
    if(this.unit.circuit) {
      this.unit.circuit.add(outlet.unit)
      modifiedCircuit = this.unit.circuit
    } else if(outlet.unit.circuit) {
      outlet.unit.circuit.add(this.unit)
      modifiedCircuit = outlet.unit.circuit
    }

    if(modifiedCircuit) {
      this.unit.computeProcessIndex()
      outlet.unit.computeProcessIndex()
      modifiedCircuit.computeOrders()
    }


    this.emit('change')
    outlet.emit('change')
    this.emit('connect', outlet)
    outlet.emit('connect', this)
  }

  setConstant(value) {
    if(this.outlet)
      this.disconnect()

    this.constant = value

    if(value.constructor != Array)
      value = [value]

    var chunk = this.signalChunk
    for(var c=0; c<chunk.channelData.length || c<value.length; c++) {
      var chanVal = value[c%value.length]
      chunk.channelData[c] = chunk.channelData[c] || new Float32Array(this.chunkSize)
      var chan = chunk.channelData[c]
      for(var t=0; t<chan.length; t++)
        chan[t] = chanVal
    }

    this.emit('change')
    this.emit('constant', value)
  }

  get printValue() {
    if(this.outlet)
      return this.outlet.label
    else return this.constant
  }
}
module.exports = Inlet

Inlet.prototype.isInlet = true
