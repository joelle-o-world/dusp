// Class from which Outlet and Inlet inherit from so that they can share code
const config = require("./config.js")
const SignalChunk = require("./SignalChunk.js")
const EventEmitter = require('events')

function Piglet(model) {
  EventEmitter.call(this)
  if(model)
    Object.assign(this, model)

  this.numberOfChannels = this.numberOfChannels || 1
  this.chunkSize = model.chunkSize || config.standardChunkSize
  this.sampleRate = config.sampleRate

  if(this.numberOfChannels == "mono" || model.mono) {
    this.numberOfChannels = 1
    this.exposeAsMono = true
  } else
    this.exposeAsMono = false

  // simple rules
  this.applyTypeRules()

  this.signalChunk = new SignalChunk(this.numberOfChannels, this.chunkSize)
}
Piglet.prototype = Object.create(EventEmitter.prototype)
Piglet.prototype.constructor = Piglet
module.exports = Piglet

Piglet.prototype.isPiglet = true

Piglet.prototype.applyTypeRules = function() {
  if(this.measuredIn == "seconds")
    this.measuredIn = "s"
  if(this.measuredIn == "s")
    this.type = "time"
  if(this.measuredIn == "samples")
    this.type = "time"

  if(this.measuredIn == "dB")
    this.type = "gain"

  if(this.measuredIn == "Hz")
    this.type = "frequency"

  if(this.type == "audio") {
    this.min = -1
    this.max = 1
  }

  if(this.type == "spectral") {
    this.complex = true
    this.real = false
  }

  if(this.type == "midi")
    this.measuredIn = "semitones"
}

Piglet.prototype.exposeDataToUnit = function() {
  if(this.exposeAsMono)
    this.unit[this.name] = this.signalChunk.channelData[0]
  else
    this.unit[this.name] = this.signalChunk.channelData
}

Piglet.prototype.__defineGetter__("label", function() {
  return this.unit.label + "." + this.name.toUpperCase()
})

Piglet.prototype.__defineGetter__("circuit", function() {
  return this.unit.circuit
})
