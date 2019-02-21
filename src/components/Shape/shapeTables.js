const config = require("../../config.js")

function makeTable(func, name) {
  var table = new Float32Array(config.sampleRate+1)
  var area = 0
  for(var x=0; x<table.length; x++) {
    table[x] = func(x/config.sampleRate)
    area += table[x]
  }

  area /= config.sampleRate+1

  return {
    data: table,
    name: name,
    area: area,
  }
}


module.exports = {
  decay: makeTable(
    (x) => { return 1-x },
    "decay"
  ),
  attack: makeTable(
    (x)=>{ return x },
    "attack"
  ),
  semiSine: makeTable(
    (x) => { return Math.sin(Math.PI * x) },
    "semiSine"
  ),
  decaySquared: makeTable(
    (x) => { return (1-x)*(1-x) },
    "decaySquared"
  )
}
