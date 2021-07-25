import Patch from "../Patch"
import Osc from "../components/Osc")
const Pan = require("../components/Pan"
import Gain from "../components/Gain"
import MidiToFrequency from "../components/MidiToFrequency"
import Sum from "../components/Sum"


class StereoOsc extends Patch {
  constructor(p, gain, pan) {
    super()

    var sum1 = new Sum()
    this.alias(sum1.A, "p")
    this.alias(sum1.B, "pControl")

    var mToF1 = new MidiToFrequency(sum1)

    var osc1 = new Osc()
    osc1.F = mToF1.FREQUENCY
    this.osc = osc1

    var gain1 = new Gain()
    gain1.IN = osc1
    this.alias(gain1.GAIN)

    var pan1 = new Pan()
    pan1.IN = gain1.OUT
    this.alias(pan1.PAN)
    this.alias(pan1.OUT)

    this.addUnit(sum1, mToF1, osc1, gain1, pan1)

    this.GAIN = gain || 0
    this.PAN = pan || 0
    this.P = p || 60
    this.PCONTROL = 0
  }

  trigger() {
    this.osc.phase = 0
  }

  get waveform() {
    return this.osc.waveform
  }
  set waveform(waveform) {
    this.osc.waveform = waveform
  }
}
export default StereoOsc
