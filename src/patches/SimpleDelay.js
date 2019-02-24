const Patch = require("../Patch.js")
const CrossFader = require("../components/CrossFader.js")
const Delay = require("../components/Delay.js")
const Sum = require("../components/Sum.js")
const Multiply = require("../components/Multiply.js")
const Repeater = require("../components/Repeater.js")
const SecondsToSamples = require("../components/SecondsToSamples.js")

function SimpleDelay(input, delay, feedback, dryWet) {
  Patch.call(this)

  this.addUnits(
    this.inputRepeater = new Repeater(),
    this.feedbackInputSum = new Sum(),
    this.delayer = new Delay(),
    this.mixDryWet = new CrossFader(),
    this.feedbackScaler = new Multiply(),
    this.delayScaler = new SecondsToSamples(),
  )

  this.feedbackInputSum.A = this.inputRepeater.OUT
  this.feedbackInputSum.B = this.feedbackScaler.OUT
  this.feedbackScaler.A = this.delayer.OUT
  this.mixDryWet.B = this.delayer.OUT
  this.mixDryWet.A = this.inputRepeater.OUT
  this.delayer.IN = this.feedbackInputSum.OUT
  this.delayer.DELAY = this.delayScaler.OUT

  this.aliasInlet(this.inputRepeater.IN)
  this.aliasInlet(this.delayScaler.IN, "delay")
  this.aliasInlet(this.feedbackScaler.B, "feedback")
  this.aliasInlet(this.mixDryWet.DIAL, "dryWet")
  this.aliasOutlet(this.mixDryWet.OUT)

  this.IN = input || 0
  this.DELAY = delay || 4410
  this.FEEDBACK = feedback || 0
  this.DRYWET = dryWet || 0.4
}
SimpleDelay.prototype = Object.create(Patch.prototype)
SimpleDelay.prototype.constructor = SimpleDelay
module.exports = SimpleDelay
