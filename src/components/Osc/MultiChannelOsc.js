import Unit from "../../Unit.js"
import config from "../../config.js"
import waveTables from "./waveTables.js"

const PHI = 2 * Math.PI

class MultiChannelOsc extends Unit {
  constructor(f, waveform) {
    super()

    this.addInlet("f", {measuredIn:"Hz"})
    this.addOutlet("out", {type:"audio"})

    this.F = f || 440
    this.phase = []
    this.waveform = waveform || "sin"
  }

  _tick(clock) {
    for(var c=0; c<this.f.length; c++) {
      this.phase[c] = this.phase[c] || 0
      this.out[c] = this.out[c] || new Float32Array(this.OUT.chunkSize)

      var f = this.f[c]
      var dataOut = this.out[c]

      var fraction
      for(var t=0; t<dataOut.length; t++) {
        this.phase[c] += f[t]
        this.phase[c] %= Unit.sampleRate
        fraction = this.phase[c]%1
        dataOut[t] = this.waveTable[Math.floor(this.phase[c])] * (1-fraction)
                      + this.waveTable[Math.ceil(this.phase[c])] * fraction
      }
    }
  }

  get waveform() {
    return this._waveform
  }
  set waveform(waveform) {
    if(waveform == "random") {
      var all = Object.keys(waveTables)
      waveform = all[Math.floor(Math.random()*all.length)]
    }
    this._waveform = waveform
    this.waveTable = waveTables[waveform]
    if(!this.waveTable)
      throw "waveform doesn't exist: " + waveform
  }

  resetPhase() {
    for(var i in this.phase)
      this.phase[i] = 0
  }
  randomPhaseFlip() {
    if(Math.random() < 0.5)
      for(var i in this.phase)
        this.phase[i] += config.sampleRate/2
  }
}
export default MultiChannelOsc
