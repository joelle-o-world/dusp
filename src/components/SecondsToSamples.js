import Unit from "../Unit.js"
import config from '../config.js'

class SecondsToSamples extends Unit {
  constructor() {
    super()
    this.addInlet("in", {measuredIn: "s"})
    this.addOutlet("out", {measuredIn: "samples"})
  }

  _tick() {
    for(var c in this.in) {
      if(this.out[c] == undefined)
        this.out[c] = new Float32Array(this.OUT.chunkSize)
      for(var t=0; t<this.in[c].length; t++)
        this.out[c][t] = this.in[c][t] * config.sampleRate
    }
  }
}
export default SecondsToSamples
