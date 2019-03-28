const {Sum, Osc} = require('../src/components')
const play = require('../src/nodePlay').buffered
const explore = require('../src/explore')
const dusp = require('../src/dusp')

// create original circuit
let osc1 = new Osc(440)
let osc2 = new Osc(new Sum(200, 100))

let sum1 = new Sum(osc1, osc2)
sum1.schedule(2, function() {
  let circuit = sum1.circuit
  console.log(circuit.units.length)
  this.B = 0
  //sum1.circuit.removeRecursively(osc2)
  console.log(circuit.units.map(u => u.label))
  console.log(dusp(sum1))
})

play(sum1, 4)
