import Unit from "../Unit.js"

class Clip extends Unit {
  constructor(threshold) {
    super()
    this.addInlet("in")
    this.addInlet("threshold")
    this.addOutlet("out")
    this.THRESHOLD = threshold
  }

  _tick() {
    for(var c=0; c<this.in.length; c++) {
      var inChannel = this.in[c]
      var thresholdChannel = this.threshold[c%this.threshold.length]
      var outChannel = this.out[c] = this.out[c] || new Float32Array(this.OUT.chunkSize)
      for(var t=0; t<inChannel.length; t++)
        outChannel[t] = Math.abs(inChannel[t]) > Math.abs(thresholdChannel[t])
                          ? thresholdChannel[t] : inChannel[t]
    }
  }
}
export default Clip
