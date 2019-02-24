const Patch = require("../Patch.js")
const Multiply = require("../components/Multiply.js")
const quick = require("../quick.js")

function StereoDetune(input, ammount) {
  Patch.call(this)

  ammount = ammount || 0.1*Math.random()

  var ratioL = quick.semitoneToRatio(ammount)
  var ratioR = quick.divide(1, ratioL)
  var ratios = quick.concat(ratioL, ratioR)

  this.addUnits(
    this.mult = new Multiply(input, ratios)
  )

  this.alias(this.mult.A, "in")
  this.alias(this.mult.OUT)
}
StereoDetune.prototype = Object.create(Patch.prototype)
StereoDetune.prototype.constructor = StereoDetune
module.exports = StereoDetune

StereoDetune.random = function(input, maxAmmount) {
  maxAmmount = maxAmmount || 0.1
  var ammount = quick.multiply(maxAmmount, Math.random())
  return new StereoDetune(input, ammount)
}
