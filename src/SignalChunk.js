class SignalChunk {
  constructor(numberOfChannels, chunkSize) {
    this.numberOfChannels = numberOfChannels
    this.chunkSize = chunkSize

    this.channelData = []
    for(var c=0; c<numberOfChannels; c++) {
      this.channelData[c] = new Float32Array(chunkSize)
    }

    this.owner = null
  }

  duplicateChannelData() {
    var data = []
    for(var i in this.channelData) {
      data[i] = this.channelData[i].slice()
    }
    return data
  }
}
export default SignalChunk
