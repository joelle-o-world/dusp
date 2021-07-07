import Unit from "../Unit.js"

class MidiToFrequency extends Unit {
  constructor(midi) {
    super()
    this.addInlet("midi", {type:"midi"})
    this.addOutlet("frequency", {measuredIn: "Hz"})

    this.MIDI = midi || 69
  }

  _tick() {
    for(var c=0; c<this.midi.length; c++) {
      var midiIn = this.midi[c]
      var fOut = this.frequency[c] || new Float32Array(this.FREQUENCY.chunkSize)
      for(var t=0; t<midiIn.length; t++)
        fOut[t] = Math.pow(2, ((midiIn[t]-69)/12)) * 440
    }
  }
}
export default MidiToFrequency
