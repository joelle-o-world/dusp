/*
  A base class for CircleBufferReader and CircleBufferWriter.
*/

const Unit = require("../Unit.js")

class CircleBufferNode extends Unit {
  constructor(buffer, offset) {
    super()

    this.t = 0
    if(buffer)
      this.buffer = buffer

    this.addInlet("offset", {measuredIn:"s"})
    this.OFFSET = offset || 0
  }

  set buffer(buffer) {
    if(this.OUT && this.OUT.isOutlet)
      while(this.out.length < buffer.numberOfChannels)
        this.out.push( new Float32Array(this.OUT.chunkSize) )
    this.channelData = buffer.channelData
    this.lengthInSamples = buffer.lengthInSamples
    this.numberOfChannels = buffer.numberOfChannels
    this._buffer = buffer
  }
  get buffer() {
    return this._buffer
  }
}
module.exports = CircleBufferNode
