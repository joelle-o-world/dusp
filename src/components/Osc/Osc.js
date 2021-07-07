import Unit from "../../Unit.js"
import waveTables from "./waveTables.js"

const PHI = 2 * Math.PI

class Osc extends Unit {
  constructor(f, waveform) {
    super()

    //console.log(this)
    this.addInlet("f", {mono: true, measuredIn:"Hz"})
    this.addOutlet("out", {mono: true, type:"audio"})

    this.F = f || 440
    this.phase = 0
    this.waveform = waveform || "sin"
  }

  get dusp() { 
    return {
      extraProperties: {
        waveform: "sin",
      },
      shorthand: function() {
        if(this.waveform == "sin") {
          if(!this.F.connected) {
            return "O" + this.F.constant
          }
        }
      }
    }
  }

  _tick(clock) {
    var dataOut = this.out
    var fraction
    for(var t=0; t<dataOut.length; t++) {
      this.phase += this.f[t]
      this.phase %= Unit.sampleRate
      if(this.phase < 0)
        this.phase += Unit.sampleRate
      fraction = this.phase%1
      dataOut[t] = this.waveTable[Math.floor(this.phase)] * (1-fraction)
                    + this.waveTable[Math.ceil(this.phase)] * fraction
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

  randomPhaseFlip() {
    if(Math.random() < 0.5)
      this.phase += Unit.sampleRate/2
  }
}
export default Osc
