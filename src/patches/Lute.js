
const Patch = require('../Patch')
const Karplus = require('./Karplus')
const Mixer = require('./Mixer')
const Pan = require('../components/Pan')
const {HandPosition} = require('fretboard-js')
const standardEADGBE = [40, 45, 50, 55, 59, 64]

class Lute extends Patch {
  constructor(tuning=standardEADGBE) {
    super()


    this.mixer = new Mixer()

    this.tuning = tuning.slice()
    this.strings = []
    for(let i=0; i<tuning.length; i++) {
      let p = tuning[i]
      let string = new Karplus
      this.mixer.addInput(new Pan(string,  i/tuning.length - 1/2))
      this.strings.push(string)
    }

    this.addUnits(this.mixer, ...this.strings)

    this.aliasOutlet(this.mixer.OUT)

    this.setPosition(HandPosition.empty())
  }

  setPosition(position) {
    let frets = position.fretsByString(this.strings.length)

    for(let i in frets) {
      let fret = frets[i]
      if(fret == null) {
        this.strings[i].setPitch(this.tuning[i])
        this.strings[i].RESONANCE = 0.1
      } else {
        this.strings[i].setPitch(this.tuning[i] + fret)
        this.strings[i].RESONANCE = 1
      }
    }

    this.position = position
  }

  changePosition(position, duration=0.1) {
    if(!this.position)
      return setPosition(position)

    let oldFingerFrets = this.position.fretsAndFingersByString(this.tuning.length)
    let fingerFrets = position.fretsAndFingersByString(this.tuning.length)

    for(let i in fingerFrets) {
      if(fingerFrets[i] == null) {
        this.strings[i].setPitch(this.tuning[i])
        this.strings[i].RESONANCE = 0.1
      } else {
        let {fret, fingerNumber} = fingerFrets[i]

        if(!fingerNumber || !oldFingerFrets[i]  || fingerNumber != oldFingerFrets[i].fingerNumber) {
          this.strings[i].setPitch(this.tuning[i] + fret)
          this.strings[i].RESONANCE = 3/4
        } else if(oldFingerFrets[i].fret != fret) {
          this.strings[i].frettedGliss(
            duration,
            this.tuning[i] + oldFingerFrets[i].fret,
            this.tuning[i] + fret,
          )
          this.strings[i].RESONANCE = 3/4
        }
      }

      this.position = position
    }

  }

  pluckAll() {
    for(let string of this.strings)
      string.pluck()
  }

  strum(duration=0.1) {
    for(let i=0; i<this.strings.length; i++) {
      let t = duration * i / this.strings.length
      this.strings[i].schedulePluck(t)
    }
  }
  strumUp(duration=0.1) {
    for(let i=0; i<this.strings.length; i++) {
      let t = duration - duration * i / this.strings.length
      this.strings[i].schedulePluck(t)
    }
  }

  pluckAllPlaying(spread=0) {
    let strings = this.position.getEngagedStrings(this.tuning.length)
    for(let j in strings) {
      let i = strings[j]

      this.strings[i].pluck()
    }
  }
  strumPlaying(duration=0.1) {
    let strings = this.position.getEngagedStrings(this.tuning.length)
    for(let j in strings) {
      let i = strings[j]

      let t = duration * i / this.strings.length
      this.strings[i].schedulePluck(t)
    }
  }
  strumUpPlaying(duration=0.1) {
    let strings = this.position.getEngagedStrings(this.tuning.length)
    for(let j in strings) {
      let i = strings[j]

      let t = duration - duration * i / this.strings.length
      this.strings[i].schedulePluck(t)
    }
  }
}
module.exports = Lute
