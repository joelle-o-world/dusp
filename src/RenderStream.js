const {Readable} = require("stream")
const AudioBuffer = require('audio-buffer')

const floatToIntScaler = Math.pow(2, 30)

class RenderStream extends Readable {
  constructor(outlet, numberOfChannels=1, timeout) {
    super({objectMode:true})
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
      // create a buffer for this chunk
      var buffer = new Float32Array(this.numberOfChannels * this.outlet.chunkSize)
      /*new AudioBuffer(null, {
        length:this.outlet.chunkSize,
        sampleRate: this.outlet.sampleRate,
        numberOfChannels: this.outlet.numberOfChannels
      })*/

      // loop through outlet SignalChunk
      for(var c=0; c<this.numberOfChannels; c++)
        for(var t=0; t<this.outlet.chunkSize; t++) {
          // rescale samples to normalise (according to peak so far)
          var val = this.outlet.signalChunk.channelData[c][t] * this.normaliseFactor

          // if signal is outside of ideal range adjust the normalisation scalar
          if(Math.abs(val) > 1) {
            var sf = Math.abs(1/val)
            val *= sf
            this.normaliseFactor *= sf
            console.warn("Digital clipping, autonormalised", this.normaliseFactor)
          }

          // throw an error is sample is NaN
          if(isNaN(val))
            throw "can't record NaN"

          // write sample to the buffer
          buffer [t*this.numberOfChannels+c] = (val)
        }

      // send to stream, pause processing if internal buffer is full
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

  stop() {
    this.push(null)
    //this.end()
  }
}
module.exports = RenderStream
