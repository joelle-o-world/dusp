import Patch from "../Patch.js"
import Repeater from "../components/Repeater.js"

import Osc from "../components/Osc/MultiChannelOsc"
import SemitoneToRatio from "../components/SemitoneToRatio.js"
import Multiply from "../components/Multiply.js"

class FMOsc extends Patch {
  constructor(f) {
    super()

    this.addUnits(
      this.fRepeater = new Repeater(),
      this.osc = new Osc(this.fRepeater),
    )

    this.osc.randomPhaseFlip()

    this.aliasInlet(this.fRepeater.IN, "f")
    this.aliasOutlet(this.osc.OUT)

    this.F = f || 440
  }

  get isFMOsc() {
    return true
  }

  addModulator(modulator, ammount) {
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

  addModulatorOsc(f, ammount) {
    this.addModulator(
      new FMOsc(f),
      ammount,
    )
  }

  clearModulation() {
    this.osc.F = this.fRepeater
  }

  resetPhase() {
    this.osc.resetPhase()
  }
}
export default FMOsc
