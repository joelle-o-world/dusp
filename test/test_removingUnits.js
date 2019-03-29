const {Sum, Osc} = require('../src/components')
const {Karplus} = require('../src/patches')
const play = require('../src/nodePlay').buffered
const explore = require('../src/explore')
const dusp = require('../src/dusp')
const unDusp = require('../src/unDusp')

// create original circuit
let karp1 = new Karplus(200)

karp1.ENERGY = unDusp('Noise * D0.01')

karp1.schedule(1, () => {
  karp1.ENERGY = unDusp('(random * 400) -> O')
  return 0.01
})

console.log('rendering:', dusp(karp1.OUT))

play(karp1, 5)
