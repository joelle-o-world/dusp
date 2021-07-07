import renderChannelData from '../renderChannelData'
import channelDataToAudioBuffer from './channelDataToAudioBuffer'

async function renderAudioBuffer(outlet, duration, options={}) {
  let channelData = await renderChannelData(outlet, duration, options)
  return channelDataToAudioBuffer(channelData)
}
export default renderAudioBuffer
