const Patch = require("../Patch.js")
const Shape = require("../components/Shape")
const Osc = require("../components/Osc")
const Multiply = require("../components/Multiply.js")

class Boop extends Patch {
  constructor(f, duration) {
    super()
    this.addUnits(
      this.osc = new Osc(f),
      this.envelope = new Shape("decay", duration).trigger(),
      this.mult = new Multiply(this.osc, this.envelope)
    )

    this.envelope.onFinish = () => {
      this.finish()
    }

    this.aliasOutlet(this.mult.OUT)
  }

  trigger() {
    this.envelope.trigger()
  }
  stop() {
    this.envelope.stop()
  }
}
module.exports = Boop
