const Patch = require("../Patch.js")
const StereoOsc = require("./StereoOsc")
const Repeater = require("../components/Repeater.js")
const Osc = require("../components/Osc")
const Sum = require("../components/Sum.js")
const Multiply = require("../components/Multiply.js")

function ManyOsc(oscs) {
  Patch.call(this)

  var mix = Sum.many(oscs)

  this.addUnits(mix, oscs)

  this.alias(mix.OUT, "OUT")
}
ManyOsc.prototype = Object.create(Patch.prototype)
ManyOsc.prototype.constructor = ManyOsc
module.exports = ManyOsc

ManyOsc.prototype.isManyOsc = true

ManyOsc.ofFrequencies = function(fundamental, ratios) {
  var oscs = []
  for(var i in ratios) {
    var osc = new Osc()
    osc.F = new Multiply(fundamental, ratios[i])
    oscs[i] = osc
  }
  var manyosc = new ManyOsc(oscs)
  return manyosc
}

ManyOsc.random = function(n, min, max) {
  n = n || 3
  min = min || 20
  max = max || 1000
  var freqs = []
  for(var i=0; i<n; i++) {
    freqs[i] = min + Math.random()*(max-min)
  }

  console.log(freqs)
  return ManyOsc.ofFrequencies(1, freqs)
}
