function constructShorthand(o, index) {
  if(o.constructor == String)
    o = parseShorthand(o)

  var args = o.arguments.map(constructNumber)

  var constructor = shorthandConstructors[o.constructorAlias]
  if(constructor)
    return constructor.apply(null, args)

  constructor = components[o.constructorAlias]
  if(constructor) {
    return new constructor(...args)
  }

  throw "Unknown shorthand: " + o.constructorAlias
}

module.exports = constructShorthand
const components = require("../patchesAndComponents")
const parseShorthand = require("../parseDSP/getShorthand.js")
const constructNumber = require("./constructNumber")
const shorthandConstructors = require("./shorthandConstructors")
