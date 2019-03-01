const Patch = require("../Patch.js")
const Noise = require("../components/Noise")
const Filter = require("../components/Filter.js")
const Repeater = require("../components/Repeater.js")
const quick = require("../quick.js")

class Worm extends Patch {
  constructor(f=1) {
    super()

    this.addUnits(
      this.noise = new Noise(),
      this.filter = new Filter(this.noise, f)
    )

    this.aliasInlet(this.filter.F)
    this.aliasOutlet(this.filter.OUT)

    this.F = f
  }

  static random(fMax = 5) {
    var f = quick.multiply(fMax, Math.random())
    return new Worm(f)
  }
}
module.exports = Worm
