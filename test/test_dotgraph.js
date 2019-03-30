const dotgraph = require('../src/dotgraph')
let unDusp = require('../src/unDusp')
const renderAudioBuffer = require('../src/webaudioapi/renderAudioBuffer')

let unit = unDusp('(Noise * D0.01) -> [Karplus]')
console.log(unit)
window.onload = function() {
  let source = null
  const audioctx = new AudioContext
  document.getElementById('input').onkeypress = async function(e) {
    if(source)
      source.stop()
    // on enter press
    if(e.keyCode == 13) {
      // parse dusp
      let outlet = unDusp(document.getElementById('input').value)

      // render graph
      dotgraph.render(document.getElementById('container'), outlet)

      // render audio
      let buffer = await renderAudioBuffer(outlet, 10)


      source = audioctx.createBufferSource()
      source.buffer = buffer
      source.connect(audioctx.destination)
      source.loop = true
      source.start()
    }
  }
}
