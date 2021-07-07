import Unit from "../Unit.js"

class SemitoneToRatio extends Unit {
  constructor(midi) {
    super()
    this.addInlet("in")
    this.addOutlet("out")

    this.IN = midi || 69
  }

  _tick() {
    for(var c=0; c<this.in.length; c++) {
      var midiIn = this.in[c]
      var fOut = this.out[c] = this.out[c] || new Float32Array(this.OUT.chunkSize)

      for(var t=0; t<midiIn.length; t++)
        fOut[t] = Math.pow(2, (midiIn[t]/12))
    }
  }
}
export default SemitoneToRatio
