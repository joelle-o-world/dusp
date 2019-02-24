const Patch = require("../Patch.js")
const Osc = require("../components/Osc")
const MidiToFrequency = require("../components/MidiToFrequency.js")

function MidiOsc(p) {
  Patch.call(this)

  this.addUnits(
    this.mToF = new MidiToFrequency(),
    this.osc = new Osc(this.mToF.FREQUENCY),
  )

  this.aliasInlet(this.mToF.MIDI, "P")
  this.aliasOutlet(this.osc.OUT)

  this.P = p || 69
}
MidiOsc.prototype = Object.create(Patch.prototype)
MidiOsc.prototype.constructor = MidiOsc
module.exports = MidiOsc
