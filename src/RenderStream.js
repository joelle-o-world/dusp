const {Readable} = require("stream")
const WavWriter = require("wav").Writer

const floatToIntScaler = Math.pow(2, 30)

class RenderStream extends Readable {
  constructor(outlet, numberOfChannels=1, timeout) {
    super()
    if(!outlet)
      throw "RenderStream requires an outlet argument"
    if(outlet.isUnitOrPatch)
      outlet = outlet.defaultOutlet

    if(!outlet.isOutlet)
      throw "RenderStream expects an outlet"

    this.numberOfChannels = numberOfChannels
    this.outlet = outlet
    this.circuit = outlet.unit.getOrBuildCircuit()
    this.sampleRate = outlet.sampleRate

    this.normaliseFactor = 1

    this.tickClock = 0

    this.outlet.onTick = () => {
      var buffer = new Buffer(4*this.outlet.chunkSize * this.numberOfChannels)
      for(var c=0; c<this.numberOfChannels; c++)
        for(var t=0; t<this.outlet.chunkSize; t++) {
          var val = this.outlet.signalChunk.channelData[c][t] * this.normaliseFactor
          if(Math.abs(val) > 1) {
            var sf = Math.abs(1/val)
            val *= sf
            this.normaliseFactor *= sf
            console.warn("Digital clipping, autonormalised", this.normaliseFactor)
          }
          if(isNaN(val))
            throw "can't record NaN"
          buffer.writeInt32LE(val * floatToIntScaler, 4*(t*this.numberOfChannels+c) )
        }

      if(!this.push(buffer)) {
        this.circuit.stopTicking()
      }
    }

    this.format = {
      channels: this.numberOfChannels,
      bitDepth: 32,
      sampleRate: this.sampleRate,
      endianness: "LE",
    }
    console.log(this.format)
  }

  _read() {
    this.circuit.startTicking()
  }

  pipeWav(destination) {
    if(!this.wavStream)
      this.wavStream = this.pipe(new WavWriter({
        channels: this.numberOfChannels,
        bitDepth: 32,
        sampleRate: this.sampleRate,
        endianness: "LE",
      }))
    return this.wavStream.pipe(destination)
  }

  stop() {
    this.push(null)
    //this.end()
  }
}
module.exports = RenderStream
