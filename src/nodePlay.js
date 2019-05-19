const Speaker = require('speaker')
const RenderStream = require('./RenderStream')
const {Transform} = require('stream')
const dusp = require('./dusp')
const renderChannelData = require('./renderChannelData')

const {FileWriter} = require('wav')



function streamToNodeSpeaker(outlet, numberOfChannels=1, timeout) {
  // create a render stream on an outlet and send it to the speakers

  let stream = new RenderStream(outlet, numberOfChannels, timeout)
  let speaker = new Speaker({
    channels:numberOfChannels,
    sampleRate: outlet.sampleRate,
    float: true,
    bitDepth:32,
  })

  let interface = new Transform({
    writableObjectMode: true,
    transform(chunk, encoding, callback) {
    //  console.log(chunk.buffer.buffer)
      callback(null, Buffer.from(chunk.buffer))
    },
  })

  console.log('playing circuit:', dusp(outlet))

  stream.pipe(interface).pipe(speaker)
}
module.exports = streamToNodeSpeaker


async function streamToNodeSpeakerBuffered(outlet, duration=1) {
  // render a buffer from an outlet and stream the buffer to the speakers
  let data = await renderChannelData(outlet, duration, {normalise:true})
  playChannelData(data)
}
module.exports.buffered = streamToNodeSpeakerBuffered

function playChannelData(channelData) {
  // stream uninterleaved channel data to the speakers

  // interleave the data
  let interleavedLength = channelData[0].length * channelData.length
  let interleaved = new Float32Array(interleavedLength)
  for(let c=0; c<channelData.length; c++) {
    let channel = channelData[c]
    for(let t=0, v=c; t<channel.length; t++, v+=channelData.length)
      interleaved[v] = channel[t]
  }

  let speaker = new Speaker({
    channels: channelData.length,
    sampleRate: channelData.sampleRate,
    bitDepth: 32,
    float: true,
  })

  speaker.write(Buffer.from(interleaved.buffer))
}
