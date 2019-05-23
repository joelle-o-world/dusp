const Karplus = require('../src/patches/Karplus')
const nodePlay = require('../src/nodePlay')
const unDusp = require('../src/unDusp')
const Lute = require('../src/patches/Lute')
const {randomHandPosition, slide, stepAndSlide, step} = require('fretboard-js')
const makeImpossiblePiece = require('../../fretboard/test/impossiblePiece')
const fs = require('fs')

let {positions, lilypond, tuning} = makeImpossiblePiece()

let lute = new Lute(tuning)
lute.setPosition(positions[0])

lute.strum()

let d = 1/17
let n = 0
let stepabout = false
let d2 = 1

let t = 0
lute.schedule(0, () => {
  t++
  if(positions.length && (t%Math.ceil(t/positions.length) == 0))
    lute.changePosition(positions[t%positions.length], d/10)
  lute.pluckAllPlaying()
  lute.schedule(d*0.8, () => lute.strumPlaying(d*0.05))
  d *= 1.01

  if(t < 4*positions.length)
    return d
  else console.log('done!')
})

fs.writeFileSync('./impossible karplus.ly', lilypond)

nodePlay(lute, 2)
