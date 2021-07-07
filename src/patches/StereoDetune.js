import Patch from "../Patch"
import Multiply from "../components/Multiply"
import quick from "../quick"

class StereoDetune extends Patch {
  constructor(input, ammount) {
    super()

    ammount = ammount || 0.1*Math.random()

    var ratioL = quick.semitoneToRatio(ammount)
    var ratioR = quick.divide(1, ratioL)
    var ratios = quick.concat(ratioL, ratioR)

    this.addUnits(
      this.mult = new Multiply(input, ratios)
    )

    this.alias(this.mult.A, "in")
    this.alias(this.mult.OUT)
  }

  static random(input, maxAmmount) {
    maxAmmount = maxAmmount || 0.1
    var ammount = quick.multiply(maxAmmount, Math.random())
    return new StereoDetune(input, ammount)
  }
}
export default StereoDetune
