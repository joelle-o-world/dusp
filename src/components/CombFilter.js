import FixedDelay from "./FixedDelay.js"

class CombFilter extends FixedDelay {
  constructor(delayTime, feedbackGain) {
    super(delayTime)

    this.addInlet("feedbackGain", {mono: true, type:"scalar"})
    this.FEEDBACKGAIN = feedbackGain || 0
  }

  _tick() {
    for(var t=0; t<this.in.length; t++) {
      this.tBuffer = (this.tBuffer+1)%this.buffer.length
      this.out[t] = this.buffer[this.tBuffer]
      this.buffer[this.tBuffer] = this.in[t] + this.out[t] * this.feedbackGain[t]
    }
  }

  get totalReverbTime() {
    return this.delayTimeInSeconds * Math.log(0.001) / Math.log(this.feedbackGain[this.feedbackGain.length-1])
  }
  set totalReverbTime(RVT) {
    this.FEEDBACKGAIN = Math.pow(0.001, this.delayTimeInSeconds/RVT)
  }
}
export default CombFilter
