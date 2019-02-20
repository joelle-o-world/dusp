const Unit = require('../src/Unit.js')

// does Unit constructor exist?
console.log('does Unit constructor exist?')
console.log('Unit (constructor):', Unit)

// can we create an instance?
console.log('Can we create an instance?')
let unit1 = new Unit()
console.log('Unit instance:', unit1)

// adding an inlet
unit1.addInlet('in')
console.log('added inlet:', unit1.IN)

unit2 = new Unit
unit2.addOutlet('out')
console.log('added outlet:', unit2.OUT)

console.log('connecting inlet to outlet')
unit1.IN = unit2.OUT
console.log(unit1, unit2)

console.log('NOW, RenderStream')
const RenderStream = require('../src/RenderStream')
console.log('RenderStream constructor:', RenderStream)

console.log('CREATE RenderStream')
unit1.addOutlet('out')
let stream1 = new RenderStream(unit1.OUT)
console.log(stream1)


// TEST OSC
console.log("\n\n~~~ TESTING Osc() ~~~")
const Osc = require('../src/components/Osc')
console.log('Osc (constructor):', Osc)

let osc1 = new Osc()
console.log("Osc (instance):", osc1)

let stream2 = new RenderStream(osc1.OUT)
console.log('osc streaming:', stream2)
