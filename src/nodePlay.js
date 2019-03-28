const Speaker = require('speaker')
const RenderStream = require('./RenderStream')
const {Transform} = require('stream')
const dusp = require('./dusp')

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
      callback(null, new Buffer(chunk.buffer))
    },
  })

  console.log('playing circuit:', dusp(outlet))

  stream.pipe(interface).pipe(speaker)
}
module.exports = streamToNodeSpeaker
