import CircleBufferNode from "./CircleBufferNode.js"

class CircleBufferWriter extends CircleBufferNode {
  constructor(buffer, offset) {
    super(buffer, offset)

    this.addInlet("in")

    this.preWipe = false
  }

  _tick() {
    for(var c=0; c<this.numberOfChannels; c++) {
      var offset = this.offset[c % this.offset.length]
      for(var t=0; t<this.tickInterval; t++) {
        var tWrite = this.t + t + this.sampleRate * offset[t]
        if(this.preWipe)
          this._buffer.write(c, tWrite, 0)
        if(this.in[c])
          this._buffer.mix(c, tWrite, this.in[c][t])
      }
    }

    this.t += this.tickInterval
  }
}
export default CircleBufferWriter
