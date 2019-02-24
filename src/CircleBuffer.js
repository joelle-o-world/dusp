const config = require("./config.js")

class CircleBuffer {
  constructor(numberOfChannels, lengthInSeconds) {
    this.numberOfChannels = numberOfChannels || 1
    this.lengthInSeconds = lengthInSeconds
    this.sampleRate = config.sampleRate
    this.lengthInSamples = Math.ceil(this.lengthInSeconds*this.sampleRate)

    this.channelData = []
    for(var c=0; c<this.numberOfChannels; c++)
      this.channelData[c] = new Float32Array(this.lengthInSamples)
  }

  read(c, t) {
    t = Math.floor(t%this.lengthInSamples)
    while(t < 0)
      t += this.lengthInSamples
    return this.channelData[c][t]
  }
  write(c, t, y) {
    t = Math.floor(t%this.lengthInSamples)
    while(t < 0)
      t += this.lengthInSamples

    this.channelData[c][t] = y
  }
  mix(c, t, y) {
    t = Math.floor(t%this.lengthInSamples)
    while(t < 0)
      t += this.lengthInSamples

    this.channelData[c][t] += y
  }
}
module.exports = CircleBuffer
