/*
  A Karplus-Strong string synthesis patch.
*/

const Patch = require("../Patch")
const config = require('../config')

// components:
const Delay = require('../components/Delay')
const Filter = require('../components/Filter')
const Sum = require('../components/Sum')
const Repeater = require('../components/Repeater')
const Divide = require('../components/Divide')
const Multiply = require('../components/Multiply')
const Noise = require('../components/Noise')
const Shape = require('../components/Shape')
const quick = require('../quick')

class Karplus extends Patch {
  constructor(frequency=500, resonance=1) {
    super()

    // assemble circuit
    this.addUnits(
      this.delayTime = new Divide(config.sampleRate, frequency),
      this.delay = new Delay(0 /*sum output*/, quick.subtract(this.delayTime, config.standardChunkSize),  config.sampleRate),
      this.cutOff = new Multiply(10000),
      this.filter = new Filter(this.delay, this.cutOff),
      this.sum = new Sum(this.filter),
    )
    this.delay.IN = this.sum.OUT
    console.log('sample rate:', this.sampleRate)


    this.aliasInlet(this.sum.B, 'energy') // trigger signal
    this.aliasInlet(this.delayTime.B, 'f') // frequency
    this.aliasInlet(this.cutOff.B, 'resonance') // resonance
    this.aliasOutlet(this.sum.OUT) // output

    this.F = frequency
    this.RESONANCE = resonance
    this.ENERGY = 0
  }

  pluck(softness=0, amplitude=1, duration=0.01) {
    if(softness.constructor != Number || softness<0 || softness>1)
      throw 'Karplus.pluck expects softness to be a number (0-1)'

    let noise = new Noise()
    if(softness)
      noise = new Filter(noise, (1-softness) * 11000 + 1, 'LP')

    let shape = new Shape('decay', duration, 0, amplitude).trigger()

    this.addEnergy(quick.multiply(noise, shape))

    return this
  }
  schedulePluck(secondDelay, softness, amplitude, duration) {
    this.schedule(secondDelay, () => {
      this.pluck(softness, amplitude, duration)
      console.log("PLUCKING")
    })
  }

  addEnergy(outlet, rescale=1) {
    outlet = quick.multiply(rescale, outlet)
    this.ENERGY = quick.sum(this.ENERGY.get(), outlet)
    return this
  }

  static interbleed(karpli, scale=0.001) {
    for(let A of karpli)
      for(let B of karpli) {
        if(A == B)
          continue
        A.addEnergy(B, scale)
      }
  }
}
module.exports = Karplus
