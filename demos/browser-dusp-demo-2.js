const unDusp = require('../src/unDusp')
const renderChannelData = require("../src/renderChannelData")
const channelDataToAudioBuffer = require("../src/webaudioapi/channelDataToAudioBuffer")

const ctx = new AudioContext()
window.AUDIOCTX = ctx

let nowPlayingRenderStream = null

console.log(unDusp)

window.onload = function() {
  document.getElementById("user-input").onkeypress = function(e) {
    if(e.keyCode == 13) {
      play(this.value)
    }
  }
}

async function play(str) {
  if(nowPlayingRenderStream)
    nowPlayingRenderStream.stop()
  let outlet = unDusp(str)
  if(!outlet)
    throw "Some problem with the input"

  let channelData = await renderChannelData(outlet, 10)

  let audioBuffer = channelDataToAudioBuffer(channelData)

  let bufferSource = new AudioBufferSourceNode(ctx, {
    buffer: audioBuffer,
  })
  bufferSource.connect(ctx.destination)
  bufferSource.start()


  console.log(channelData)
  console.log(audioBuffer)
}
