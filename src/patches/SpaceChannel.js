const Patch = require("../Patch.js")
const Subtract = require("../components/Subtract.js")
const VectorMagnitude = require("../components/VectorMagnitude.js")
const Multiply = require("../components/Multiply.js")
const Gain = require("../components/Gain.js")
const MonoDelay = require("../components/MonoDelay.js")
const config = require("../config.js")

function SpaceChannel(speakerPosition) {
  Patch.call(this)

  // make units
  this.addUnits(
    this.speakerPositionSubtracter = new Subtract(),
    this.distanceCalculator = new VectorMagnitude(),
    this.attenuationScaler = new Multiply(),
    this.delayScaler = new Multiply(),
    this.delayer = new MonoDelay(),
    this.attenuator = new Gain(),
  )

  // make connections
  this.distanceCalculator.IN = this.speakerPositionSubtracter.OUT
  this.attenuationScaler.A = this.distanceCalculator.OUT
  this.delayScaler.A = this.distanceCalculator.OUT
  this.attenuator.GAIN = this.attenuationScaler.OUT
  this.delayer.DELAY = this.delayScaler.OUT
  this.delayer.IN = this.attenuator.OUT

  // aliasing
  this.aliasInlet(this.attenuator.IN)
  this.aliasInlet(this.speakerPositionSubtracter.A, "placement")
  this.aliasInlet(this.speakerPositionSubtracter.B, "speakerPosition")
  this.aliasInlet(this.attenuationScaler.B, "decibelsPerMeter")
  this.aliasInlet(this.delayScaler.B, "sampleDelayPerMeter")
  this.aliasOutlet(this.delayer.OUT)

  // defaults
  this.IN = 0
  this.PLACEMENT = [0,0]
  this.SPEAKERPOSITION = speakerPosition || [0,0]
  this.DECIBELSPERMETER = -3
  this.SAMPLEDELAYPERMETER = config.sampleRate / 343
}
SpaceChannel.prototype = Object.create(Patch.prototype)
SpaceChannel.prototype.constructor = SpaceChannel
module.exports = SpaceChannel
