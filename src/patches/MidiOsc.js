import Patch from "../Patch.js"
import Osc from "../components/Osc"
import MidiToFrequency from "../components/MidiToFrequency.js"

class MidiOsc extends Unit {
  constructor(p) {
    super()

    this.addUnits(
      this.mToF = new MidiToFrequency(),
      this.osc = new Osc(this.mToF.FREQUENCY),
    )

    this.aliasInlet(this.mToF.MIDI, "P")
    this.aliasOutlet(this.osc.OUT)

    this.P = p || 69
  }
}
export default MidiOsc
