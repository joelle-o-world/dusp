const renderChannelData = require('../renderChannelData')
const channelDataToAudioBuffer = require('./channelDataToAudioBuffer')

async function renderAudioBuffer(outlet, duration, options={}) {
  let channelData = await renderChannelData(outlet, duration, options)
  return channelDataToAudioBuffer(channelData)
}
module.exports = renderAudioBuffer
