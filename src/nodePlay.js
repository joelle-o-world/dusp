const Speaker = require('speaker')
const RenderStream = require('./RenderStream')
const {Transform} = require('stream')
const dusp = require('./dusp')
const renderChannelData = require('./renderChannelData')

function streamToNodeSpeaker(outlet, numberOfChannels=1, timeout) {
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
  let data = await renderChannelData(outlet, duration)
  playChannelData(data)
}
module.exports.buffered = streamToNodeSpeakerBuffered

function playChannelData(channelData) {
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
