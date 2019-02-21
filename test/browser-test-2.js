const Osc = require("../src/components/Osc")
const RenderStream = require("../src/RenderStream")

const Writable = require('web-audio-stream/writable')

let osc1 = new Osc([1000,500])
let oscStream = new RenderStream(osc1.OUT, 2)

window.onclick = function() {
  let context = new AudioContext()

  let writable = Writable(context.destination, {
    context: context,
    channels: 2,
    sampleRate: context.sampleRate,
    samplesPerFrame: oscStream.outlet.chunkSize,

    //BUFFER_MODE, SCRIPT_MODE, WORKER_MODE (pending web-audio-workers)
    mode: Writable.SCRIPT_MODE,

    //disconnect node if input stream ends
    autoend: true
  })



  /*const Generator = require('audio-generator')
  let src = Generator(function (time) {
      return Math.sin(Math.PI * 2 * time * 440)
  })
  src.pipe(process.stdout)*/
  oscStream.pipe(writable)
}
