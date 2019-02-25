const RenderStream = require("./RenderStream")
const WritableWAA = require('web-audio-stream/writable')

function connectToWAA(outlet, destination) {
  // stream an outlet into a Web Audio API destination
  console.log('nc', outlet.numberOfChannels)
  if(outlet.numberOfChannels != 1)
    console.warn('streaming multichannel ('+outlet.numberOfChannels+') outlet to WAA')

  let writable = WritableWAA(destination, {
    context: destination.context,
    channels: outlet.numberOfChannels,
    sampleRate: outlet.sampleRate,
    samplesPerFrame: outlet.chunkSize,

    mode: WritableWAA.SCRIPT_MODE,

    autoend: true,
  })

  let renderStream = new RenderStream(outlet, outlet.numberOfChannels)
  renderStream.pipe(writable)
  
  return renderStream
}
module.exports = connectToWAA
