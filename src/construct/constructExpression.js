import parseExpression from "../parseDSP/getExpression.js"
import constructObject from "./constructObject"
import constructNumber from "./constructNumber"
import constructObjectReference from "./constructObjectReference"
import constructOperation from "./constructOperation"
import constructObjectProperty from "./constructObjectProperty"
import constructShorthand from "./constructShorthand"
import constructString from "./constructString"

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

export default constructExpression

