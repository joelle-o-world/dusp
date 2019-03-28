const Karplus = require('../src/patches/Karplus')
const unDusp = require('../src/unDusp')
const dusp = require('../src/dusp')
const renderChannelData = require("../src/renderChannelData")
const play = require('../src/nodePlay')
const quick = require('../src/quick')
const Mixer = require('../src/')
const Pan = require('../src/components/Pan')

const HandPosition = require('../../fretboard/src/HandPosition')
const move = require('../../fretboard/src/allHandMoves.js')

const tuning = [40, 45, 50, 55, 59, 64].map(p => p)

let position1 = HandPosition.empty()
let position2 = move.random(position1)
let position3 = move.random(position2)
console.log(position1.fretsByString())

let strings = []
for(let pitch of tuning) {
  strings.push( new Karplus(quick.pToF(pitch), Math.random()) )
}
//Karplus.interbleed(strings)

function setHand(position) {
  let frets = position.fretsByString()
  for(let i in strings) {
    let f = quick.pToF(
      tuning[i] + (frets[i] || 0)// + Math.random()/100
    )
    console.log(f)
    strings[i].F = f
    if(frets[i] == null && Math.random() < 0)
      strings[i].RESONANCE = 0.1
    else
      strings[i].RESONANCE = 1//Math.random()
  }
}

setHand(position1)

for(let i=0; i<strings.length; i++) {
  let string = strings[i]
  let bow = unDusp('(Noise -> LP500) * (D0.01) ! 1.0'+i)
  string.addEnergy(bow)
  //string.schedulePluck( i/12 * 5, Math.random())
  //string.schedulePluck(5+ i/12 * 5, Math.random())
  //string.schedulePluck(10+ i/12 * 5, Math.random())
}

strings[0].schedule(1, () => {
  position1 = move.random(position1)
  setHand(move.random(position1))
  return 1
})


let mix = quick.mix(...strings.map(
  (string, i) => new Pan(string, i/tuning.length - 0.5)
))


play(mix, 2)
