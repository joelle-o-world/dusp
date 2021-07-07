import CircleBufferNode from "./CircleBufferNode.js"

class CircleBufferReader extends CircleBufferNode {
  constructor(buffer, offset) {
    super(null, offset)
    this.addOutlet("out")

    this.buffer = buffer
    this.postWipe = false
  }

  _tick() {
    for(var c=0; c<this.numberOfChannels; c++) {
      var offset = this.offset[c%this.offset.length]
      for(var t=0; t<this.tickInterval; t++) {
        var tRead = this.t + t - this.sampleRate*offset[t]
        this.out[c][t] = this._buffer.read(c, tRead)

        if(this.postWipe)
          this._buffer.write(c, tRead, 0)
      }
    }

    this.t += this.tickInterval
  }
}
export default CircleBufferReader
