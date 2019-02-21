const Unit = require("../../Unit.js")

class Windower extends Unit {
  constructor(windowSize /*in samples*/, kind="hamming", hopSize) {
    super()
    if(!windowSize)
      throw "Windower constructor expects a windowSize"
    this.addInlet("in", {chunkSize:windowSize})
    this.addOutlet("out", {chunkSize: windowSize})
    this.tickInterval = hopSize

    this.windowSize = windowSize
    this.windowKind = kind
    this.envelopeBuffer = Windower.getEnvelope(windowSize, kind)
  }

  _tick() {
    for(var c=0; c<this.in.length; c++) {
      var out = this.out[c] = this.out[c] || new Array(this.windowSize)
      for(var t=0; t<this.windowSize; t++)
        out[t] = this.in[c][t] * this.envelopeBuffer[t]
    }
  }
}
module.exports = Windower

Windower.envelopes = {}
Windower.envelopeFunctions = {
  "hamming": (n, N) => {
    return Math.pow( Math.sin((Math.PI * n) / (N-1)) , 2 )
  }
}
Windower.windowSpectrums = {}
function getEnvelope(size, type) {
  var F = Windower.envelopeFunctions[type]
  if(!F)
    throw "Window type \'"+type+"\' is not defined."
  var name = type + size
  if(Windower.envelopes[name])
    return Windower.envelopes[name]

  var env = new Float32Array(size)
  for(var n=0; n<size; n++)
    env[n] = F(n, size)

  Windower.envelopes[name] = env
  return env
}
Windower.getEnvelope = getEnvelope
