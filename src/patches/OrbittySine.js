import Patch from "../Patch.js"
import MidiOsc from "./MidiOsc"
import Osc from "../components/Osc"
import Space from "./Space.js"
import ComplexOrbit from "./ComplexOrbit.js"

class OrbittySine extends Patch {
  constructor(f, speed, r, centre) {
    super()

    this.addUnits(
      this.osc = new Osc(),
      this.orbit = new ComplexOrbit.random(),
      this.space = new Space(this.osc, this.orbit),
    )

    this.aliasInlet(this.osc.F, "f")
    this.aliasInlet(this.orbit.F, "speed")
    this.aliasInlet(this.orbit.R, "r")
    this.aliasInlet(this.orbit.CENTRE, "centre")
    this.aliasOutlet(this.space.OUT, "out")

    this.F = f || 200
    this.SPEED = speed || 1
    this.R = r || 1
    this.CENTRE = centre || [0,0]
  }

  get waveform() {
    return this.osc.waveform
  }
  set waveform(waveform) {
    this.osc.waveform = waveform
  }
}
export default OrbittySine
