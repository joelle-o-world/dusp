const config = require("../config.js")
const Patch = require("../Patch.js")
const MidiOsc = require("../patches/MidiOsc.js")
const Ramp = require("../components/Ramp.js")
const Multiply = require("../components/Multiply.js")
const Shape = require("../components/Shape")

function SineBoop(p, duration) {
  Patch.call(this)


  this.addUnits(
    this.osc = new MidiOsc(p),
    this.ramp = new Shape("decay", duration),
    this.multiply = new Multiply(this.ramp, this.osc.OUT),
  )

  this.alias(this.osc.P, "p")
  this.alias(this.ramp.DURATION)
  this.alias(this.multiply.OUT)
  //this.alias(this.ramp.T)

  console.log(this.ramp.print)

  this.P = p || 60
  this.DURATION = duration || 1
}
SineBoop.prototype = Object.create(Patch.prototype)
SineBoop.prototype.constructor = SineBoop
module.exports = SineBoop

SineBoop.randomTwinkle = function(maxDuration) {
  var boop = new SineBoop()
  boop.P = 100 + Math.random()*37
  boop.ramp.randomDecay(maxDuration || 1)
  return boop
}

SineBoop.prototype.trigger = function() {
  this.ramp.trigger()
  this.osc.phase = 0
  return this
}
