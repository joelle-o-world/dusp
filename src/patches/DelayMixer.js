const Patch = require("../Patch")
const CircleBuffer = require("../CircleBuffer.js")
const CircleBufferReader = require("../components/CircleBufferReader.js")
const CircleBufferWriter = require("../components/CircleBufferWriter.js")
const quick = require("../quick.js")

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
module.exports = DelayMixer
