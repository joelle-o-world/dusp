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

class Karplus extends Patch {
  constructor(frequency=500, resonance=1) {
    super()

    // assemble circuit
    this.addUnits(
      this.frequencyRepeater = new Repeater,
      this.delayTime = new Divide(config.sampleRate, this.frequencyRepeater),
      this.delay = new Delay(0 /*sum output*/, this.delayTime,  config.sampleRate/10),
      this.cutOff = new Multiply(10000),
      this.filter = new Filter(this.delay, this.cutOff),
      this.sum = new Sum(this.filter),
    )
    this.delay.IN = this.sum.OUT
    console.log('sample rate:', this.sampleRate)


    this.aliasInlet(this.sum.B, 'energy') // trigger signal
    this.aliasInlet(this.frequencyRepeater.IN, 'f') // frequency
    this.aliasInlet(this.cutOff.B, 'resonance') // resonance
    this.aliasOutlet(this.sum.OUT) // output

    this.F = frequency
    this.RESONANCE = resonance
    this.ENERGY = 0


  }
}
module.exports = Karplus
