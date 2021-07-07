import config from "../config"
import Patch from "../Patch"
import MidiOsc from "../patches/MidiOsc"
import Ramp from "../components/Ramp"
import Multiply from "../components/Multiply"
import Shape from "../components/Shape"

class SineBoop extends Patch {
  constructor(p, duration) {
    super()


    this.addUnits(
      this.osc = new MidiOsc(p),
      this.ramp = new Shape("decay", duration),
      this.multiply = new Multiply(this.ramp, this.osc.OUT),
    )

    this.alias(this.osc.P, "p")
    this.alias(this.ramp.DURATION)
    this.alias(this.multiply.OUT)
    //this.alias(this.ramp.T)

    console.log(this.ramp.print)

    this.P = p || 60
    this.DURATION = duration || 1
  }

  static randomTwinkle(maxDuration) {
    var boop = new SineBoop()
    boop.P = 100 + Math.random()*37
    boop.ramp.randomDecay(maxDuration || 1)
    return boop
  }

  trigger() {
    this.ramp.trigger()
    this.osc.phase = 0
    return this
  }
}
export default SineBoop
