import Patch from "../Patch.js"
import CircleBuffer from "../CircleBuffer.js"
import CircleBufferReader from "../components/CircleBufferReader.js"
import CircleBufferWriter from "../components/CircleBufferWriter.js"
import quick from "../quick.js"


class MultiTapDelay extends Patch {
  constructor(nChannels, maxDelay, input) {
    super()

    if(!nChannels || !maxDelay)
      throw "MultiTapDelay requires constructor args (nChannels, maxDelay[, input])"

    this.addUnits(
      this.buffer = new CircleBuffer(nChannels, maxDelay),
      this.writer = new CircleBufferWriter(this.buffer),
    )

    this.writer.preWipe = true

    this.aliasInlet(this.writer.IN)

    this.IN = input || 0
  }

  addTap(delay) {
    var reader = new CircleBufferReader(this.buffer, delay)
    reader.t = this.writer.t
    this.addUnits(reader)
    reader.chain(this.writer)
    return reader
  }

  addFeedback(delay, feedbackGain, feedbackDelay) {
    var reader = this.addTap(delay)
    var writer = new CircleBufferWriter(this.buffer, feedbackDelay || 0)
    writer.IN = quick.multiply(reader, feedbackGain)
    writer.t = this.writer.t
    writer.chain(this.writer)
    this.addUnits(writer)
    return reader
  }
}
export default MultiTapDelay
