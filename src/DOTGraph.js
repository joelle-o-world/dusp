const explore = require('./explore')
const vis = require('vis')


function generateDOTGraph(...units) {
  // generate a dot graph describing the relationship between units

  let lines = []
  for(let unit of explore(...units)) {
    for(let inlet of unit.inletsOrdered) {
      if(inlet.outlet) {
        let line = '\"'+inlet.outlet.unit.label + '\" -> \"'+unit.label+'\";'
        lines.push(line)
      }
    }
  }

  // indent lines
  lines = lines.map(line => '\t'+line)

  return [
    'digraph circuit {',
    ...lines,
    '}'
  ].join('\n')
}
module.exports = generateDOTGraph

function renderGraph(container, ...units) {
  let DOTstring = generateDOTGraph(...units)

  var parsedData = vis.network.convertDot(DOTstring);

  var data = {
    nodes: parsedData.nodes,
    edges: parsedData.edges
  }

  var options = parsedData.options;

  // you can extend the options like a normal JSON variable:
  options.nodes = {
    color: {
      border:'black',
      background:'white',
    }
  }

  console.log(data, options)

  // create a network
  var network = new vis.Network(container, data, options);

  return network
}
module.exports.render = renderGraph
