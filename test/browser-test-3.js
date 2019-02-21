const Osc = require("../src/components/Osc")
const connectToWAA = require("../src/connectToWAA.js")

let osc1 = new Osc([1000,500])

window.onclick = function() {
  let context = new AudioContext()

  connectToWAA(osc1.OUT, context.destination)
}
