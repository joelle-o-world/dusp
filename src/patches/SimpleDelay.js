import Patch from "../Patch"
import CrossFader from "../components/CrossFader"
import Delay from "../components/Delay"
import Sum from "../components/Sum"
import Multiply from "../components/Multiply"
import Repeater from "../components/Repeater"
import SecondsToSamples from "../components/SecondsToSamples"

class SimpleDelay extends Unit {
  constructor(input, delay, feedback, dryWet) {
    super()

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
}
export default SimpleDelay
