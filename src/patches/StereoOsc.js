const Patch = require("../Patch.js")
const Osc = require("../components/Osc.js")
const Pan = require("../components/Pan.js")
const Gain = require("../components/Gain.js")
const MidiToFrequency = require("../components/MidiToFrequency.js")
const Sum = require("../components/Sum.js")


function StereoOsc(p, gain, pan) {
  Patch.call(this)

  var sum1 = new Sum()
  this.alias(sum1.A, "p")
  this.alias(sum1.B, "pControl")

  var mToF1 = new MidiToFrequency(sum1)

  var osc1 = new Osc()
  osc1.F = mToF1.FREQUENCY
  this.osc = osc1

  var gain1 = new Gain()
  gain1.IN = osc1
  this.alias(gain1.GAIN)

  var pan1 = new Pan()
  pan1.IN = gain1.OUT
  this.alias(pan1.PAN)
  this.alias(pan1.OUT)

  this.addUnit(sum1, mToF1, osc1, gain1, pan1)

  this.GAIN = gain || 0
  this.PAN = pan || 0
  this.P = p || 60
  this.PCONTROL = 0
}
StereoOsc.prototype = Object.create(Patch.prototype)
StereoOsc.prototype.constructor = StereoOsc
module.exports = StereoOsc

StereoOsc.prototype.trigger = function() {
  this.osc.phase = 0
}

StereoOsc.prototype.__defineGetter__("waveform", function() {
  return this.osc.waveform
})
StereoOsc.prototype.__defineSetter__("waveform", function(waveform) {
  this.osc.waveform = waveform
})
