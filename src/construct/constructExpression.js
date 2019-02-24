function constructExpression(o, index, destinations) {
  if(o.constructor == String)
    o = parseExpression(o, index)
  if(o.constructor == String)
    throw "Can't construct expression: " + o

  switch(o.type) {
    case "object":
      return constructObject(o, index)
    case "number":
      return constructNumber(o, index)

    case "id":
      return constructObjectReference(o, index)

    case "operation":
      return constructOperation(o, index, destinations)

    case "objectProperty":
      return constructObjectProperty(o, index)

    case "shorthand":
      return constructShorthand(o, index)

    case "unnamedArgument":
      return constructExpression(o.value, index)

    case "string":
      return constructString(o, index)

    case "json":
      return o.o

    default:
      throw "Unknown expression type: " + o.type
  }
}

module.exports = constructExpression
const parseExpression = require("../parseDSP/getExpression.js")
const constructObject = require("./constructObject")
const constructNumber = require("./constructNumber")
const constructObjectReference = require("./constructObjectReference")
const constructOperation = require("./constructOperation")
const constructObjectProperty = require("./constructObjectProperty")
const constructShorthand = require("./constructShorthand")
const constructString = require("./constructString")
