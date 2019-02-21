const Unit = require("../../Unit.js")
const gcd = require("compute-gcd")
const lcm = require("compute-lcm")

class ReChunk extends Unit {
  constructor(inputInterval, outputInterval) {
    super()
    if(!inputInterval || !outputInterval)
      throw "ReChunk expects 2 numeric contructor arguments"

    this.inputInterval = inputInterval
    this.outputInterval = outputInterval

    this.addInlet("in", {chunkSize: this.inputInterval})
    this.addOutlet("out", {chunkSize: this.outputInterval})
    console.log(this.inputInterval, this.outputInterval)
    this.tickInterval = gcd(this.inputInterval, this.outputInterval)

    this.bufferSize = lcm(this.inputInterval, this.outputInterval)
    //                  ^ is this correct??

    this.buffer = [] // multichanel circular internal buffer
    this.t = 0
  }

  _tick() {
    // copy input to internal buffer (if appropriate)
    if(this.t%this.inputInterval == 0)
      for(var c=0; c<this.in.length; c++) {
        var buffer = this.buffer[c] = this.buffer[c] || new Array(this.bufferSize).fill(0)
        for(var t=0; t<this.inputInterval; t++)
          buffer[(this.t+t)%buffer.length] = this.in[c][t]
      }

    // increment t
    this.t += this.tickInterval

    // copy internal buffer to output (if appropriate)
    if(this.t%this.outputInterval == 0) {
      var t0 = this.t-this.outputInterval
      for(var c=0; c<this.buffer.length; c++) {
        var out = this.out[c] = this.out[c] || new Array(this.outputInterval)
        var buffer = this.buffer[c]
        for(var t=0; t<this.outputInterval; t++)
          out[t] = buffer[(t0+t)%buffer.length]
      }
    }


  }
}
module.exports = ReChunk
