const components = require('../src/components')
const patches = require('../src/patches')
const {dusp} = require('../src')
const fs = require('fs')

let lines = ['Units:']
for(let name in components) {
  try {
    let unit = new components[name]()
    let str = dusp(unit)
    lines.push(str)
  } catch(e) {
    null
  }
}

lines.push('Patches:')
for(let name in patches) {
  try {
    let unit = new patches[name]()
    let args = []
    for(let name in unit.inlets) {
      args.push(name.toUpperCase()+':' + unit.inlets[name].constant)
    }
    let str = '[' + name + ' '
      + args.join(' ')
      + ']'
    lines.push(str)
  } catch(e) {
  }
}

let doc = lines.join('\n')

fs.writeFileSync('Unit and patch defaults.txt', doc)
