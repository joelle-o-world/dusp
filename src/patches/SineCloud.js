const Patch = require("../Patch.js")
const OrbittySine = require("./OrbittySine.js")
const Mixer = require("./Mixer.js")
const Repeater = require("../components/Repeater.js")
const Multiply = require("../components/Multiply.js")

function SineCloud(f, speed, r, centre) {
  Patch.call(this)

  this.addUnits(
    this.mixer = new Mixer(),
    this.frequencyRepeater = new Repeater(1),
    this.speedRepeater = new Repeater(1),
    this.radiusRepeater = new Repeater(1),
    this.centreRepeater = new Repeater([0,0]),
  )
  this.orbittySines = []

  this.aliasInlet(this.frequencyRepeater.IN, "f")
  this.aliasInlet(this.speedRepeater.IN, "speed")
  this.aliasInlet(this.radiusRepeater.IN, "r")
  this.aliasInlet(this.centreRepeater.IN, "centre")
  this.aliasOutlet(this.mixer.OUT)

  this.F = f || 1
  this.SPEED = speed || 1
  this.R = r || 1
  this.CENTRE = centre || [0,0]
}
SineCloud.prototype = Object.create(Patch.prototype)
SineCloud.prototype.constructor = SineCloud
module.exports = SineCloud

SineCloud.prototype.addSine = function(f, speed, r) {
  var sine = new OrbittySine(
    new Multiply(f || 1, this.frequencyRepeater),
    new Multiply(speed || 1, this.speedRepeater),
    new Multiply(r || 1, this.radiusRepeater),
    this.centreRepeater,
  )
  this.addUnit(sine)
  this.mixer.addInput(sine)

  this.orbittySines.push(sine)

  return this
}

SineCloud.prototype.__defineSetter__("waveform", function(waveform) {
  for(var i in this.orbittySines)
    this.orbittySines[i].waveform = waveform
})
