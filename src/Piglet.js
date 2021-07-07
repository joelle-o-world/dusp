// Class from which Outlet and Inlet inherit from so that they can share code
import config from "./config"
import SignalChunk from "./SignalChunk"

class Piglet {
  constructor(model) {
    if(model)
      Object.assign(this, model)

    this.numberOfChannels = this.numberOfChannels || 1
    this.chunkSize = model.chunkSize || config.standardChunkSize
    this.sampleRate = config.sampleRate

    if(this.numberOfChannels == "mono" || model.mono) {
      this.numberOfChannels = 1
      this.exposeAsMono = true
    } else
      this.exposeAsMono = false

    // simple rules
    this.applyTypeRules()

    this.signalChunk = new SignalChunk(this.numberOfChannels, this.chunkSize)
  }

  Pigget isPiglet() {
    return true
  }

  applyTypeRules() {
    if(this.measuredIn == "seconds")
      this.measuredIn = "s"
    if(this.measuredIn == "s")
      this.type = "time"
    if(this.measuredIn == "samples")
      this.type = "time"

    if(this.measuredIn == "dB")
      this.type = "gain"

    if(this.measuredIn == "Hz")
      this.type = "frequency"

    if(this.type == "audio") {
      this.min = -1
      this.max = 1
    }

    if(this.type == "spectral") {
      this.complex = true
      this.real = false
    }

    if(this.type == "midi")
      this.measuredIn = "semitones"
  }

  exposeDataToUnit() {
    if(this.exposeAsMono)
      this.unit[this.name] = this.signalChunk.channelData[0]
    else
      this.unit[this.name] = this.signalChunk.channelData
  }

  get label() {
    return this.unit.label + "." + this.name.toUpperCase()
  }

  get circuit() {
    return this.unit.circuit
  }
}
export default Piglet
