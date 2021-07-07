import Patch from "../Patch"
import CircleBuffer from "../CircleBuffer.js"
import CircleBufferReader from "../components/CircleBufferReader.js"
import CircleBufferWriter from "../components/CircleBufferWriter.js"
import quick from "../quick.js"

class DelayMixer extends Patch {
  constructor(nChannels, maxDelay) {
    super()

    if(!nChannels || !maxDelay)
      throw "DelayMixer requires constructor arguments: (nChannels, maxDelay)"

    this.buffer = new CircleBuffer(nChannels, maxDelay)

    this.addUnits(
      this.outReader = new CircleBufferReader(this.buffer)
    )
    this.outReader.postWipe = true

    this.aliasOutlet(this.outReader.OUT)
  }

  addInput(input, delay, attenuation) {
    var writer = new CircleBufferWriter(this.buffer, delay)
    writer.t = this.outReader.t
    this.outReader.chain(writer)
    this.addUnits(writer)

    if(attenuation)
      writer.IN = quick.multiply(input, attenuation)
    else
      writer.IN = input
  }
}
export default DelayMixer
