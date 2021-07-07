import CombFilter from "./CombFilter.js"

class AllPass extends CombFilter {
  constructor(delayTime, feedbackGain) {
    super(delayTime, feedbackGain)
  }

  _tick() {
    for(var t=0; t<this.in.length; t++) {
      this.tBuffer = (this.tBuffer+1)%this.buffer.length
      var delayOut = this.buffer[this.tBuffer]
      this.buffer[this.tBuffer] = this.in[t] + delayOut * this.feedbackGain[t]
      this.out[t] = delayOut - this.in[t] * this.feedbackGain[t]
    }
  }

  static random(maxDelayTime, maxFeedbackGain) {
    return new AllPass(
      (maxDelayTime || 1) * Math.random(), // delay time
      (maxFeedbackGain || 1) * Math.random(), // feedbackGain
    )
  }

  static manyRandom(n, maxDelay, maxFeedback) {
    var list = []
    for(var i=0; i<n; i++) {
      var delay = 2/this.sampleRate + Math.random()*(maxDelay-2/this.sampleRate)
      while(delay == 0)
        var delay = Math.random()*maxDelay

      var ap = new AllPass(Math.random()*maxDelay, Math.random()*maxFeedback)
      list.push(ap)
    }
    return list
  }

  static manyRandomInSeries(n, maxDelayTime, maxFeedbackGain) {
    var allpasses = []
    for(var i=0; i<n; i++) {
      allpasses[i] = AllPass.random(maxDelayTime, maxFeedbackGain)
      if(i != 0)
        allpasses[i].IN = allpasses[i-1].OUT
    }
    return {
      list: allpasses,
      IN: allpasses[0].IN,
      OUT: allpasses[i-1].OUT,
    }
  }
}

export default AllPass
