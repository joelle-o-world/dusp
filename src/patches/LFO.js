const Patch = require("../Patch.js")
const Osc = require("../components/Osc")
const Multiply = require("../components/Multiply.js")
const Sum = require("../components/Sum.js")

function LFO(frequency, amplitude, origin, waveform) {
  Patch.call(this)

  var osc1 = new Osc()
  this.alias(osc1.F)
  this.osc = osc1

  var mult1 = new Multiply(osc1.OUT)
  this.alias(mult1.B, "a")

  var location = new Sum(mult1.OUT)
  this.alias(location.B, "o")
  this.alias(location.OUT)

  this.addUnits(
    osc1, mult1, location
  )

  this.F = frequency || 1
  this.A = amplitude || 1/2
  this.O = origin || 1/2
  this.waveform = waveform || "sine"
}
LFO.prototype = Object.create(Patch.prototype)
LFO.prototype.constructor = LFO
module.exports = LFO

LFO.randomInRange = function(maxF, minMin, maxMax, waveform) {
  var a = minMin + (maxMax-minMin) * Math.random()
  var b = minMin + (maxMax-minMin) * Math.random()
  if(a > b) {
    var max = a
    var min = b
  } else {
    var max = b
    var min = a
  }

  return new LFO(
    Math.random()*maxF,
    (min + max)/2,
    Math.random() * (max-min),
    waveform,
  )
}

LFO.prototype.__defineGetter__("waveform", function() {
  return this.osc.waveform
})
LFO.prototype.__defineSetter__("waveform", function(waveform) {
  this.osc.waveform = waveform
})
