const Karplus = require('../src/patches/Karplus')
const nodePlay = require('../src/nodePlay')
const unDusp = require('../src/unDusp')
const Lute = require('../src/patches/Lute')
const {randomHandPosition, slide, stepAndSlide, step} = require('fretboard-js')

let tuning = [40, 45, 50, 55, 59, 64]//.map(p=>p+12)
//let tuning = [60, 60.5, 61, 61.5, 62, 62.5]
const options = {
  numberOfStrings:tuning.length,
  tuning:tuning,
  numberOfFingers:4,
}

let position1 = randomHandPosition(options)
console.log(position1)

let lute = new Lute(tuning)
lute.setPosition(position1)

lute.strum()

let d = 4
let n = 0
let stepabout = false
let d2 = 1

lute.schedule(0, () => {
  lute.strum(d/4)
  lute.schedule(d/2, () => lute.strumUp(d/8))
  if(d<6)
    return d
})

lute.schedule(0, () => {
  n++
  if(n%8) {
    let newPos = slide.random(lute.position, options)
    lute.changePosition(newPos, d2/10)
  }
  return d2
})

lute.schedule(d*8, () => {
  if(stepabout) {
    let newPos = step.random(lute.position, options)
    lute.changePosition(newPos)
  }
  return 1/4
})

lute.schedule(d*12, () => {
  if(d > 0.05){
    d *= 0.5
    stepabout = !stepabout
    return 16
  } else{
    d = 4
    stepabout = false
    lute.schedule(d, () => {
      d *= 1.05
      d2 *= 1.05
      console.log('kjnvs', d)
      return d
    })
  }
})

nodePlay(lute, 2)
