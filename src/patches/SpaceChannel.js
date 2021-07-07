import Patch from "../Patch"
import Subtract from "../components/Subtract"
import VectorMagnitude from "../components/VectorMagnitude"
import Multiply from "../components/Multiply"
import Gain from "../components/Gain"
import MonoDelay from "../components/MonoDelay"
import config from "../config"

class SpaceChannel extends Patch {
  constructor(speakerPosition) {
    super()

    // make units
    this.addUnits(
      this.speakerPositionSubtracter = new Subtract(),
      this.distanceCalculator = new VectorMagnitude(),
      this.attenuationScaler = new Multiply(),
      this.delayScaler = new Multiply(),
      this.delayer = new MonoDelay(),
      this.attenuator = new Gain(),
    )

    // make connections
    this.distanceCalculator.IN = this.speakerPositionSubtracter.OUT
    this.attenuationScaler.A = this.distanceCalculator.OUT
    this.delayScaler.A = this.distanceCalculator.OUT
    this.attenuator.GAIN = this.attenuationScaler.OUT
    this.delayer.DELAY = this.delayScaler.OUT
    this.delayer.IN = this.attenuator.OUT

    // aliasing
    this.aliasInlet(this.attenuator.IN)
    this.aliasInlet(this.speakerPositionSubtracter.A, "placement")
    this.aliasInlet(this.speakerPositionSubtracter.B, "speakerPosition")
    this.aliasInlet(this.attenuationScaler.B, "decibelsPerMeter")
    this.aliasInlet(this.delayScaler.B, "sampleDelayPerMeter")
    this.aliasOutlet(this.delayer.OUT)

    // defaults
    this.IN = 0
    this.PLACEMENT = [0,0]
    this.SPEAKERPOSITION = speakerPosition || [0,0]
    this.DECIBELSPERMETER = -3
    this.SAMPLEDELAYPERMETER = config.sampleRate / 343
  }
}
export default SpaceChannel
