import Patch from "../Patch.js"
import Repeater from "../components/Repeater.js"
import quick from "../quick.js"

class FrequencyGroup extends Unit {
  constructor(f) {
    super()

    this.addUnits(
      this.fundamentalRepeater = new Repeater(f || 440, "Hz")
    )

    this.fOuts = [this.fundamentalRepeater.OUT]

    this.alias(this.fundamentalRepeater.IN, "f")

    //this.F = f || 440
  }

  addHarmonic(ratio) {
    var harmonic = quick.mult(this.fOuts[0], ratio)
    this.fOuts.push(
      harmonic,
    )
    return harmonic
  }
  addRandomHarmonic(maxNum, maxDenom) {
    maxNum = maxNum || 8
    maxDenom = maxDenom || 8
    var numerator = Math.ceil(Math.random() * maxNum)
    var denominator = Math.ceil(Math.random()*maxDenom)
    return this.addHarmonic(numerator/denominator)
  }
  addRandomHarmonics(n, maxNum, maxDenom) {
    n = n || 1
    var harmonicsAdded = []
    for(var i=0; i<n; i++)
      harmonicsAdded[i] = this.addRandomHarmonic(maxNum, maxDenom)
    return harmonicsAdded
  }
}
export default FrequencyGroup
