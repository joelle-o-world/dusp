const Patch = require("../Patch.js")
const MidiOsc = require("./MidiOsc")
const Osc = require("../components/Osc")
const Space = require("./Space.js")
const ComplexOrbit = require("./ComplexOrbit.js")

function OrbittySine(f, speed, r, centre) {
  Patch.call(this)

  this.addUnits(
    this.osc = new Osc(),
    this.orbit = new ComplexOrbit.random(),
    this.space = new Space(this.osc, this.orbit),
  )

  this.aliasInlet(this.osc.F, "f")
  this.aliasInlet(this.orbit.F, "speed")
  this.aliasInlet(this.orbit.R, "r")
  this.aliasInlet(this.orbit.CENTRE, "centre")
  this.aliasOutlet(this.space.OUT, "out")

  this.F = f || 200
  this.SPEED = speed || 1
  this.R = r || 1
  this.CENTRE = centre || [0,0]
}
OrbittySine.prototype = Object.create(Patch.prototype)
OrbittySine.prototype.constructor = OrbittySine
module.exports = OrbittySine

OrbittySine.prototype.__defineGetter__("waveform", function() {
  return this.osc.waveform
})
OrbittySine.prototype.__defineSetter__("waveform", function(waveform) {
  this.osc.waveform = waveform
})
