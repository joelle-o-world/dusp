import Patch from "../Patch.js"
import Filter from "../components/Filter.js"

class BandFilter extends Patch {
  constructor(input, fLow, fHigh) {
    super()

    this.addUnits(
      this.lowPass = new Filter(input, fHigh, "LP"),
      this.highPass = new Filter(this.lowPass.OUT, fLow, "HP")
    )
    this.highPass.kind = "HP"
    console.log(this.highPass)

    this.aliasInlet(this.lowPass.IN)
    this.aliasInlet(this.lowPass.F, "fHigh")
    this.aliasInlet(this.highPass.F, "fLow")
    this.aliasOutlet(this.highPass.OUT)
  }
}
export default BandFilter
