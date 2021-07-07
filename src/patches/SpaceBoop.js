import Patch from "../Patch"
import config from "../config"

import MidiToFrequency from "../components/MidiToFrequency"
import Osc from "../components/Osc")
import Shape from "../components/Shape")
import Multiply from "../components/Multiply"
import Space from "../patches/Space"
import Divide from "../components/Divide"

class SpaceBoop extends Patch {
  constructor(p, waveform, d, decayForm, place) {
    super()

    this.addUnits(
      this.mToF = new MidiToFrequency(),
      this.osc = new Osc(this.mToF),
      this.durationToRate = new Divide(1/config.sampleRate),
      this.envelope = new Shape("decay", this.durationToRate),
      this.envelopeAttenuator = new Multiply(this.osc, this.envelope),
      this.space = new Space(this.envelopeAttenuator.OUT),
    )

    this.aliasInlet(this.mToF.MIDI, "p")
    this.aliasInlet(this.space.PLACEMENT, "placement")
    this.aliasInlet(this.durationToRate.B, "duration")
    this.aliasOutlet(this.space.OUT)

    this.P = p || 60
    this.PLACEMENT = place || [0, 0]
    this.DURATION = d || 1
    this.waveform = waveform || "sin"
    this.decayForm = decayForm || "decay"
  }

  trigger(pitch, duration) {
    if(pitch)
      this.P = pitch
    if(duration)
      this.DURATION = duration
    this.osc.phase = 0
    this.envelope.trigger()
  }

  get waveform() {
    return this.osc.waveform
  }
  set waveform(waveform) {
    this.osc.waveform = waveform
  }
  get decayForm() {
    return this.envelope.shape
  }
  set decayForm(shape) {
    this.envelope.shape = shape
  }
}
export default SpaceBoop
