const Speaker = require('speaker')
const RenderStream = require('./RenderStream')
const {Transform} = require('stream')

function streamToNodeSpeaker(outlet, numberOfChannels, timeout) {
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
      callback(null, new Buffer(chunk.buffer))
    },
  })

  stream.pipe(interface).pipe(speaker)
}
module.exports = streamToNodeSpeaker
