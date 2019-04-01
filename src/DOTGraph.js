const explore = require('./explore')
const vis = require('vis')


function generateDOTGraph(mainOutlet) {
  // generate a dot graph describing the relationship between units

  if(!mainOutlet.isOutlet)
    mainOutlet = mainOutlet.defaultOutlet
  let mainUnit = mainOutlet.unit

  let nConstants = 0

  let lines = ['\"OUT\" [color=brown, fontcolor=black, shape=star];']
  for(let unit of explore(mainUnit)) {
    let att = {shape:'circle', label:unit.constructor.name} // atributes
    let type = unit.constructor.name
    let color = '#'
    for(let i=0; i<3; i++)
      color += type.charCodeAt(i%type.length).toString(16)[0].repeat(2)
    att.color = '\"' + color + '\"'
    console.log(color)
    switch(unit.constructor.name) {
      case 'Sum':
        att.label = '\"+\"'
        att.shape = 'circle'
        att.color = '"#003300"'
        att.fontcolor = 'white'
        break;
      case 'Subtract':
        att.label = '\"-\"'
        att.shape = 'circle'
        att.color = '"#003300"'
        att.fontcolor = 'white'
        break;
      case 'Multiply':
        att.label = '"*"'
        att.shape = 'circle'
        att.color = '"#009900"'
        att.fontcolor = 'white'
        break;
      case 'Divide':
        att.label = '"÷"'
        att.shape = 'circle'
        att.color = '"#009900"'
        att.fontcolor = 'white'
        break;
      case 'Repeater':
        att.label = '""'
        att.color = 'green'
        break;
      case 'Shape':
        att.shape = 'triangle'
        att.color = '"#ffcc00"'
        att.fontcolor = '"#ffcc00"'
        att.label = unit.shape
        break;

      case 'MultiChannelOsc':
      case 'Osc':
        att.shape = 'circle'
        att.color = '"#000066"'
        att.fontcolor = 'white'
        att.label = unit.waveform
        break;

      case 'Noise':
        att.shape = 'box'
        delete att.color
        break;

      case 'Retriggerer':
        att.shape = 'square'
        att.color = 'red'
        break
    }
    let attList = []
    for(let i in att) {
      attList.push(i + '=' + att[i])
    }
    let attStr = '['+attList.join(', ')+']'
    lines.push('\"'+unit.label+'\" '+attStr+';')

    if(unit == mainUnit)
      lines.push('\"'+unit.label+'\" -> \"OUT\"')
    for(let inlet of unit.inletsOrdered) {
      if(inlet.outlet) {
        let line = '\"'+inlet.outlet.unit.label + '\" -> \"'+unit.label+'\" [label="'+inlet.name+'", fontcolor='+(att.color || 'black')+'];'
        lines.push(line)
      } else {
        // create constant
        let constant = parseFloat(inlet.constant).toPrecision(3)

        let nodeName = '\"constant'+nConstants+'\"'
        lines.push(nodeName+' [label=\"'+constant+'\", fontcolor=grey, color="#ccccff", shape=circle];')
        nConstants++
        let arrow = '->'

        lines.push(nodeName+' '+arrow+' \"'+unit.label+'\" [label="'+inlet.name+'", fontcolor="#ccccff", fontsize=10];')
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
    },
  }
  options.layout = {improvedLayout: false}

  // create a network
  var network = new vis.Network(container, data, options);
  console.log(network)

  return network
}
module.exports.render = renderGraph
