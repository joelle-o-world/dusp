throw "FMSynth will not work until unDusp has been reimplemented"

const Synth = require("./Synth.js")
const unDusp = require("../unDusp")
const dusp = require("../dusp")

const quick = require("../quick.js")
const Osc = require("../patches/FMOsc")
const FrequencyGroup = require("./FrequencyGroup.js")
const StereoDetune = require("./StereoDetune.js")
const Mixer = require("./Mixer.js")
const Shape = require("../components/Shape")
const Worm = require("./Worm.js")

class FMSynth extends Synth {
  constructor(seed) {
    super()
    this.resetOscsOnTrigger = seed.resetOscsOnTrigger || true

    // unDusp the seed
    var unduspIndex = {}
    var fundamental = unDusp(seed.fundamental, unduspIndex)
    var globalModulation = unDusp(seed.mod || 1, unduspIndex)
    var envelopes = (seed.envelopes || []).map(env => unDusp(env, unduspIndex))
    var oscSeeds = seed.oscs.map(osc => {return {
      h: unDusp(osc.h, unduspIndex),
      stereoDetune: unDusp(osc.stereoDetune || 0, unduspIndex),
      modulation: (osc.modulation || []).map(attenuation => unDusp(attenuation, unduspIndex)),
      mix: unDusp(osc.mix || 0, unduspIndex)
    }})


    // make a dusp version of the seed
    var duspIndex = {}
    this.seed = {
      fundamental: dusp(fundamental, duspIndex),
      mod: dusp(globalModulation, duspIndex),
      oscs: oscSeeds.map(osc => {
        var oscSeed = {
          h: dusp(osc.h, duspIndex),
        }
        if(osc.stereoDetune)
          oscSeed.stereoDetune = dusp(osc.stereoDetune, duspIndex)
        if(osc.mix)
          oscSeed.mix = dusp(osc.mix, duspIndex)
        if(osc.modulation && osc.modulation.length)
          oscSeed.modulation = osc.modulation.map(attenuation => dusp(attenuation, duspIndex))
        return oscSeed
      }),
      resetOscsOnTrigger: this.resetOscsOnTrigger,
    }
    if(envelopes.length)
      this.seed.envelopes = envelopes.map(env => dusp(env, duspIndex))

    if(dusp.usingShorthands)
      console.warn("Possible unDusping errors with this seed, multiple references to the envelopes which may be shorthanded")


    for(var i in envelopes)
      this.addEnvelope(envelopes[i])

    var fGroup = new FrequencyGroup(fundamental)
    for(var i in oscSeeds)
      fGroup.addHarmonic(oscSeeds[i].h)


    var oscs = []
    for(var i=0; i<oscSeeds.length; i++) {
      if(oscSeeds[i].stereoDetune)
        oscs[i] = new Osc(
          new StereoDetune(fGroup.fOuts[i+1], oscSeeds[i].stereoDetune)
        )
      else
        oscs[i] = new Osc(fGroup.fOuts[i+1])
    }


    for(var carrier in oscSeeds)
      if(oscSeeds[carrier].modulation)
        for(var modulator in oscSeeds[carrier].modulation) {
          var ammount = oscSeeds[carrier].modulation[modulator]
          if(ammount) {
            oscs[carrier].addModulator(oscs[modulator], quick.multiply(ammount, globalModulation))
          }
        }

    var mixer = new Mixer()
    for(var i in oscs) {
      if(oscSeeds[i].mix)
        mixer.addInput(quick.multiply(oscs[i], oscSeeds[i].mix))
    }

    this.oscs = oscs
    this.addUnits(fGroup, oscs, mixer)

    this.aliasOutlet(mixer.OUT, "OUT")
    this.aliasInlet(fGroup.F, "F")
  }

  _trigger(p) {
    this.F = quick.pToF(p)
    if(this.resetOscsOnTrigger)
      for(var i in this.oscs)
        this.oscs[i].resetPhase()
  }

  static randomSeed({
    f = 50,
    duration = 1,
    nOscs = 8,
    pConnection = 0.1,
    maxModulationAmmount = 6,
    pMix = 0.5,
    maxStereoDetune = 1/2,
  }) {
    nOscs = nOscs || 4

    var oscs = []
    var envelopes = []
    for(var i=0; i<nOscs; i++) {
      var osc = {
        h: Math.ceil(Math.random()*32),
        modulation: [],
      //  stereoDetune: Math.random() * maxStereoDetune,
      }
      if(Math.random() < pMix) {
        var envelope = Shape.randomDecay(duration, 0, 1)
        envelopes.push(envelope)
        osc.mix = quick.multiply(envelope, Math.random())
      }
      for(var j=0; j<nOscs; j++) {
        if(Math.random() < pConnection) {
          var envelope = Shape.randomInRange(duration, 0, 1)
          envelopes.push(envelope)
          osc.modulation.push(envelope, quick.multiply(Math.random(), maxModulationAmmount))
        }
      }
      oscs.push(osc)
    }

    return {
      fundamental: f,
      oscs: oscs,
      envelopes: envelopes,
    }
  }

  static wormSeed({
    f = 50,
    nOscs = 8,
    pConnection = 0.1,
    maxModulationAmmount = 6,
    pMix = 0.5,
    maxStereoDetune = 1/2,
    maxHarmonic = 16,
    maxWormFrequency = 5
  }) {
    nOscs = nOscs || 4

    var oscs = []
    var envelopes = []
    for(var i=0; i<nOscs; i++) {
      var osc = {
        h: Math.ceil(quick.multiply(Math.random(), maxHarmonic)),
        modulation: [],
        stereoDetune: Math.random() * maxStereoDetune,
      }
      if(Math.random() < pMix) {
        var envelope = Math.random()//Worm.random()
        envelopes.push(envelope)
        osc.mix = quick.multiply(envelope, Math.random())
      }
      for(var j=0; j<nOscs; j++) {
        if(Math.random() < pConnection) {
          var envelope = Worm.random(maxWormFrequency)
          envelopes.push(envelope)
          osc.modulation.push(envelope, quick.multiply(Math.random(), maxModulationAmmount))
        }
      }
      oscs.push(osc)
    }

    return {
      fundamental: f,
      oscs: oscs,
      envelopes: envelopes,
    }
  }
}
module.exports = FMSynth
