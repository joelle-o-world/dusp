
const Unit = require("../../Unit.js")
const waveTables = require("./waveTables.js")

const PHI = 2 * Math.PI

function Osc(f, waveform) {
  Unit.call(this)

  //console.log(this)
  this.addInlet("f", {mono: true, measuredIn:"Hz"})
  this.addOutlet("out", {mono: true, type:"audio"})

  this.F = f || 440
  this.phase = 0
  this.waveform = waveform || "sin"
}
Osc.prototype = Object.create(Unit.prototype)
Osc.prototype.constructor = Osc
module.exports = Osc

Osc.prototype.dusp = {
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

Osc.prototype._tick = function(clock) {
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

Osc.prototype.__defineGetter__("waveform", function() {
  return this._waveform
})
Osc.prototype.__defineSetter__("waveform", function(waveform) {
  if(waveform == "random") {
    var all = Object.keys(waveTables)
    waveform = all[Math.floor(Math.random()*all.length)]
  }
  this._waveform = waveform
  this.waveTable = waveTables[waveform]
  if(!this.waveTable)
    throw "waveform doesn't exist: " + waveform
})

Osc.prototype.randomPhaseFlip = function() {
  if(Math.random() < 0.5)
    this.phase += Unit.sampleRate/2
}
