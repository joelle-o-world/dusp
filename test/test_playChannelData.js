const play = require('../src/nodePlay').buffered
const unDusp = require('../src/unDusp')

let outlet = unDusp('O440')
console.log(play)

play(outlet, 5)
