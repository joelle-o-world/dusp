const dotgraph = require('../src/dotgraph')
let unDusp = require('../src/unDusp')

let unit = unDusp('O200 + O300')

window.onload = function() {
  console.log(
    dotgraph.render(document.body, unit)
  )
}
