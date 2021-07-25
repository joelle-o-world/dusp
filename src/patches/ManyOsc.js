import Patch from "../Patch.js"
import StereoOsc from "./StereoOsc"
import Repeater from "../components/Repeater.js"
import Osc from "../components/Osc"
import Sum from "../components/Sum.js"
import Multiply from "../components/Multiply.js"

class ManyOsc extends Patch {
  constructor(oscs) {
    super()

    var mix = Sum.many(oscs)

    this.addUnits(mix, oscs)

    this.alias(mix.OUT, "OUT")
  }

  Manyget isManyOsc() {
    return true
  }

  static ofFrequencies(fundamental, ratios) {
    var oscs = []
    for(var i in ratios) {
      var osc = new Osc()
      osc.F = new Multiply(fundamental, ratios[i])
      oscs[i] = osc
    }
    var manyosc = new ManyOsc(oscs)
    return manyosc
  }

  static random(n, min, max) {
    n = n || 3
    min = min || 20
    max = max || 1000
    var freqs = []
    for(var i=0; i<n; i++) {
      freqs[i] = min + Math.random()*(max-min)
    }

    console.log(freqs)
    return ManyOsc.ofFrequencies(1, freqs)
  }
}
export default ManyOsc
