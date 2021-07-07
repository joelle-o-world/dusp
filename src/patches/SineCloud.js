import Patch from "../Patch"
import OrbittySine from "./OrbittySine"
import Mixer from "./Mixer"
import Repeater from "../components/Repeater"
import Multiply from "../components/Multiply"

class SineCloud extends Patch {
  constructor(f, speed, r, centre) {
    super()

    this.addUnits(
      this.mixer = new Mixer(),
      this.frequencyRepeater = new Repeater(1),
      this.speedRepeater = new Repeater(1),
      this.radiusRepeater = new Repeater(1),
      this.centreRepeater = new Repeater([0,0]),
    )
    this.orbittySines = []

    this.aliasInlet(this.frequencyRepeater.IN, "f")
    this.aliasInlet(this.speedRepeater.IN, "speed")
    this.aliasInlet(this.radiusRepeater.IN, "r")
    this.aliasInlet(this.centreRepeater.IN, "centre")
    this.aliasOutlet(this.mixer.OUT)

    this.F = f || 1
    this.SPEED = speed || 1
    this.R = r || 1
    this.CENTRE = centre || [0,0]
  }

  addSine(f, speed, r) {
    var sine = new OrbittySine(
      new Multiply(f || 1, this.frequencyRepeater),
      new Multiply(speed || 1, this.speedRepeater),
      new Multiply(r || 1, this.radiusRepeater),
      this.centreRepeater,
    )
    this.addUnit(sine)
    this.mixer.addInput(sine)

    this.orbittySines.push(sine)

    return this
  }

  set waveform(waveform) {
    for(var i in this.orbittySines)
      this.orbittySines[i].waveform = waveform
  }
}
export default SineCloud
