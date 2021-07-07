import Patch from "../Patch.js"
import Space from "./Space.js"
import Repeater from "../components/Repeater.js"
import Multiply from "../components/Multiply.js"

class ScaryPatch extends Patch {
  constructor(input, ammount) {
    super()

    this.addUnits(
      this.inRepeater = new Repeater(),
      this.ammountScaler = new Multiply(this.inRepeater, 1),
      this.space = new Space(
        this.inRepeater,
        this.ammountScaler
      ),
    )

    this.alias(this.inRepeater.IN)
    this.aliasInlet(this.ammountScaler.B, "ammount")
    this.alias(this.space.OUT)

    this.IN = input || [0,0]
    this.AMMOUNT = ammount || 1
  }
}
export default ScaryPatch
