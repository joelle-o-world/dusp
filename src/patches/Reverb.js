const Patch = require("../Patch.js")

const AllPass = require("../components/AllPass.js")
const Filter = require("../components/Filter.js")
const CombFilter = require("../components/CombFilter.js")
const FixedDelay = require("../components/FixedDelay.js")
const Repeater = require("../components/Repeater.js")
const Mixer = require("../Mixer.js")

function Reverb() {
  Patch.call(this)

  console.warn("Reverb class doesn't work")

  this.addUnits(
    this.inRepeater = new Repeater()
    this.mixer = new Mixer()
  )

  this.aliasInlet(this.inRepeater.IN)
  this.aliasOutlet(this.mixer.OUT)
}
Reverb.prototype = Object.create(Patch.prototype)
Reverb.prototype.constructor = Reverb
module.exports = Reverb
