const {Sum, Osc} = require('../src/components')
const play = require('../src/nodePlay').buffered

// create original circuit
let osc1 = new Osc(440)
let osc2 = new Osc(new Sum(200, 100))

let sum1 = new Sum(osc1, osc2)
sum1.schedule(2, function() {
  console.log(sum1.circuit.units.length)
  this.B = 0
  sum1.circuit.remove(osc2, ...osc2.neighbours)
  console.log(sum1.circuit.units.length)
})

play(sum1, 4)
