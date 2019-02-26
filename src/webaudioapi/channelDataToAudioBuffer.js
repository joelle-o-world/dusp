const AudioBuffer = require('audio-buffer')

function channelDataToAudioBuffer(channelData) {
  let audioBuffer = new AudioBuffer({
    sampleRate: channelData.sampleRate,
    numberOfChannels: channelData.length,
    length: channelData[0].length,
  })

  for(let c=0; c<channelData.length; c++) {
    audioBuffer.copyToChannel(channelData[c], c)
  }

  return audioBuffer
}
module.exports = channelDataToAudioBuffer
