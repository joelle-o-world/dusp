import Unit from "../../Unit.js"
import gcd from "compute-gcd"

class Hopper extends Unit {
  constructor(hopSize, frameSize) {
    super();
    this.addInlet("in")
    this.addOutlet("out", {chunkSize: frameSize})

    this.hopSize = hopSize
    this.frameSize = frameSize

    this.buffer = [] // multiple circular buffers
    this.t = 0
    this.tickInterval = gcd(hopSize, this.IN.chunkSize)
  }

  _tick() {
    // copy input to the circular buffer
    for(var c=0; c<this.in.length; c++) {
      var buffer = this.buffer[c] = this.buffer[c] || new Array(this.frameSize).fill(0)
      for(var t=0; t<this.tickInterval; t++)
        buffer[(this.t+t)%this.frameSize] = this.in[c][(this.t + t)%this.in[c].length]
    }

    //increment this.t
    this.t += this.tickInterval

    if(this.t%this.hopSize == 0)
      // copy output from circular buffer to output
      for(var c=0; c<this.buffer.length; c++) {
        var out = this.out[c] = this.out[c] || new Array(this.frameSize)
        var buffer = this.buffer[c]
        for(var t=0; t<this.frameSize; t++)
          out[t] = buffer[(t + this.t)%this.frameSize]
      }
  }
}
export default Hopper
