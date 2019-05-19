const Unit = require("../Unit.js")

/*function MidiToFrequency(midi) {
  Unit.call(this)
  this.addInlet("midi", {type:"midi"})
  this.addOutlet("frequency", {measuredIn: "Hz"})

  this.MIDI = midi || 69
}
MidiToFrequency.prototype = Object.create(Unit.prototype)
MidiToFrequency.prototype.constructor = MidiToFrequency
module.exports = MidiToFrequency

MidiToFrequency.prototype._tick = function() {
  for(var c=0; c<this.midi.length; c++) {
    var midiIn = this.midi[c]
    var fOut = this.frequency[c] || new Float32Array(this.FREQUENCY.chunkSize)
    for(var t=0; t<midiIn.length; t++)
      fOut[t] = Math.pow(2, ((midiIn[t]-69)/12)) * 440
  }
}*/

class MidiToFrequency extends Unit {
  constructor(midi=69) {
    super()
    this.addInlet('midi', {type:'midi'})
    this.addOutlet('frequency', {measuredIn:'Hz'})

    this.MIDI = midi
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
MidiToFrequency.prototype.isMidiToFrequency = true
module.exports = MidiToFrequency
