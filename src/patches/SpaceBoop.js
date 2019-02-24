const Patch = require("../Patch.js")
const config = require("../config.js")

const MidiToFrequency = require("../components/MidiToFrequency.js")
const Osc = require("../components/Osc")
const Shape = require("../components/Shape")
const Multiply = require("../components/Multiply.js")
const Space = require("../patches/Space.js")
const Divide = require("../components/Divide.js")

function SpaceBoop(p, waveform, d, decayForm, place) {
  Patch.call(this)

  this.addUnits(
    this.mToF = new MidiToFrequency(),
    this.osc = new Osc(this.mToF),
    this.durationToRate = new Divide(1/config.sampleRate),
    this.envelope = new Shape("decay", this.durationToRate),
    this.envelopeAttenuator = new Multiply(this.osc, this.envelope),
    this.space = new Space(this.envelopeAttenuator.OUT),
  )

  this.aliasInlet(this.mToF.MIDI, "p")
  this.aliasInlet(this.space.PLACEMENT, "placement")
  this.aliasInlet(this.durationToRate.B, "duration")
  this.aliasOutlet(this.space.OUT)

  this.P = p || 60
  this.PLACEMENT = place || [0, 0]
  this.DURATION = d || 1
  this.waveform = waveform || "sin"
  this.decayForm = decayForm || "decay"
}
SpaceBoop.prototype = Object.create(Patch.prototype)
SpaceBoop.prototype.constructor = SpaceBoop
module.exports = SpaceBoop

SpaceBoop.prototype.trigger = function(pitch, duration) {
  if(pitch)
    this.P = pitch
  if(duration)
    this.DURATION = duration
  this.osc.phase = 0
  this.envelope.trigger()
}

SpaceBoop.prototype.__defineGetter__("waveform", function() {
  return this.osc.waveform
})
SpaceBoop.prototype.__defineSetter__("waveform", function(waveform) {
  this.osc.waveform = waveform
})
SpaceBoop.prototype.__defineGetter__("decayForm", function() {
  return this.envelope.shape
})
SpaceBoop.prototype.__defineSetter__("decayForm", function(shape) {
  this.envelope.shape = shape
})
