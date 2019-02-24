const Patch = require("../Patch.js")
const Repeater = require("../components/Repeater.js")
const quick = require("../quick.js")

function FrequencyGroup(f) {
  Patch.call(this)

  this.addUnits(
    this.fundamentalRepeater = new Repeater(f || 440, "Hz")
  )

  this.fOuts = [this.fundamentalRepeater.OUT]

  this.alias(this.fundamentalRepeater.IN, "f")

  //this.F = f || 440
}
FrequencyGroup.prototype = Object.create(Patch.prototype)
FrequencyGroup.prototype.constructor = FrequencyGroup
module.exports = FrequencyGroup

FrequencyGroup.prototype.addHarmonic = function(ratio) {
  var harmonic = quick.mult(this.fOuts[0], ratio)
  this.fOuts.push(
    harmonic,
  )
  return harmonic
}
FrequencyGroup.prototype.addRandomHarmonic = function(maxNum, maxDenom) {
  maxNum = maxNum || 8
  maxDenom = maxDenom || 8
  var numerator = Math.ceil(Math.random() * maxNum)
  var denominator = Math.ceil(Math.random()*maxDenom)
  return this.addHarmonic(numerator/denominator)
}
FrequencyGroup.prototype.addRandomHarmonics = function(n, maxNum, maxDenom) {
  n = n || 1
  var harmonicsAdded = []
  for(var i=0; i<n; i++)
    harmonicsAdded[i] = this.addRandomHarmonic(maxNum, maxDenom)
  return harmonicsAdded
}
