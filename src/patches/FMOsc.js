const Patch = require("../Patch.js")
const Repeater = require("../components/Repeater.js")

const Osc = require("../components/MultiChannelOsc")
const SemitoneToRatio = require("../components/SemitoneToRatio.js")
const Multiply = require("../components/Multiply.js")

function FMOsc(f) {
  Patch.call(this)

  this.addUnits(
    this.fRepeater = new Repeater(),
    this.osc = new Osc(this.fRepeater),
  )

  this.osc.randomPhaseFlip()

  this.aliasInlet(this.fRepeater.IN, "f")
  this.aliasOutlet(this.osc.OUT)

  this.F = f || 440
}
FMOsc.prototype = Object.create(Patch.prototype)
FMOsc.prototype.constructor = FMOsc
module.exports = FMOsc

FMOsc.prototype.isFMOsc = true

FMOsc.prototype.addModulator = function(modulator, ammount) {
  ammount = ammount || 1

  var multiply1 = new Multiply(modulator, ammount)
  var m2f = new SemitoneToRatio(multiply1)
  var multiply2 = new Multiply(m2f, this.osc.F.outlet)

  this.addUnits(
    multiply1,
    multiply2,
    m2f,
  )

  this.osc.F = multiply2
}

FMOsc.prototype.addModulatorOsc = function(f, ammount) {
  this.addModulator(
    new FMOsc(f),
    ammount,
  )
}

FMOsc.prototype.clearModulation = function() {
  this.osc.F = this.fRepeater
}

FMOsc.prototype.resetPhase = function() {
  this.osc.resetPhase()
}
