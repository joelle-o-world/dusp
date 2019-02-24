const Osc = require("../src/components/Osc")
const Sum = require('../src/components/Sum')
const connectToWAA = require("../src/connectToWAA.js")

let osc1 = new Osc(400)
let osc2 = new Osc(600)
let sum1 = new Sum(osc1, osc2)

window.onclick = function() {
  let context = new AudioContext()

  connectToWAA(sum1.OUT, context.destination)

  window.onclick = null
}
