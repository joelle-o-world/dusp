const Patch = require("../Patch.js")

const Mixer = require("./Mixer.js")
const FMOsc = require("./FMOsc")
const FrequencyGroup = require("./FrequencyGroup.js")
const StereoDetune = require("./StereoDetune.js")

function FMSynth(f) {
  Patch.call(this)

  this.addUnits(
    this.mixer = new Mixer(),
    this.fgroup = new FrequencyGroup(),
  )

  this.oscs = []

  this.aliasInlet(this.fgroup.F, "f")
  this.aliasOutlet(this.mixer.OUT, "out")

  this.F = f || 440
  this.stereo = true
}
FMSynth.prototype = Object.create(Patch.prototype)
FMSynth.prototype.constructor = FMSynth
module.exports = FMSynth

FMSynth.prototype.addOsc = function(fRatio, master, inAmmounts, outAmmounts) {
  fRatio = fRatio || 1
  var f = this.fgroup.addHarmonic(fRatio)
  if(this.stereo)
    f = new StereoDetune(f)
  var osc = new FMOsc(f)
  this.oscs.push(osc)
  this.addUnits(osc)

  if(master)
    this.mixer.addMultiplied(osc, master)

  if(inAmmounts)
    for(var i=0; i<inAmmounts.length && i<this.oscs.length; i++)
      if(this.oscs[i] && inAmmounts[i])
        osc.addModulator(this.oscs[i], inAmmounts[i])

  if(outAmmounts)
    for(var i=0; i<outAmmounts.length && i<this.oscs.length; i++)
      if(this.oscs[i] && outAmmounts[i])
        this.oscs[i].addModulator(osc, outAmmounts[i])

  return osc
}

FMSynth.prototype.clearModulation = function() {
  for(var i in this.oscs)
    this.oscs[i].clearModulation()
}

FMSynth.prototype.applyModulationMatrix = function(matrix) {
  this.clearModulation()
  for(var i in matrix) {
    for(var j in matrix[i]) {
      if(matrix[i][j] && this.oscs[i] && this.oscs[j])
        this.oscs[j].addModulator(this.oscs[i], matrix[i][j])
    }
  }
}
