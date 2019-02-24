const Patch = require("../Patch.js")
const Space = require("./Space.js")
const Repeater = require("../components/Repeater.js")
const Multiply = require("../components/Multiply.js")

function ScaryPatch(input, ammount) {
  Patch.call(this)

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
ScaryPatch.prototype = Object.create(Patch.prototype)
ScaryPatch.prototype.constructor = ScaryPatch
module.exports = ScaryPatch
