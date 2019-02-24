/*
  A spectrally implemented band pass filter with sqaure attenuation curves.
*/


const Patch = require("../Patch.js")

const HardLP = require("../components/spectral/HardLowPass.js")
const HardHP = require("../components/spectral/HardHighPass.js")


class HardBandPass extends Patch {
  constructor(input, low, high) {
    super()

    this.addUnits(
      this.lp = new HardLP(low),
      this.hp = new HardHP(high),
    )

    this.hp.IN = this.lp.OUT

    this.aliasInlet(this.lp.IN, "in")
    this.aliasInlet(this.hp.F, "low")
    this.aliasInlet(this.lp.F, "high")
    this.aliasOutlet(this.hp.OUT)

    this.IN = input || 0
    console.log("low:", low)
    this.LOW = low || 0
    this.HIGH = high || 22000
  }
}
module.exports = HardBandPass
