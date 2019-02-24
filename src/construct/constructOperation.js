function constructOperation(o, index, destinations) {
  if(!o.a || !o.b || !o.operator)
    throw "could not construct operation"

  var a = constructExpression(o.a, index)
  var b = constructExpression(o.b, index)

  switch(o.operator) {
    case "*":
      return quick.multiply(a, b)
    case "/":
      return quick.divide(a, b)
    case "+":
      return quick.add(a, b)
    case "-":
      return quick.subtract(a, b)
    case ",":
      return quick.concat(a, b)
    case "@":
      return new components.Pan(a, b)
    case "^":
      return quick.pow(a, b)
    case "->":
      if(b.isUnitOrPatch) {
        b.defaultInlet.set(a)
        return b
      } else
        throw "unknown use of -> operator"

    case "|<":
      return quick.clipBelow(b, a)

    case ">|":
      return quick.clipAbove(a, b)

    case "for":
      if(a.constructor == Number)
        a = new Repeater(a)
      if(a.scheduleFinish)
        a.scheduleFinish(b)
      else
        throw "invalid use of 'for' operator. First operand has no scheduleFinish function"
      return a

    case "then":
      var out
      if(!destinations || !destinations.length) {
        out = new Repeater
        out.IN = a
        destinations = [(x) => {
          out.IN = x
        }]
      }
      a.onFinish = () => {
        for(var i in destinations)
          destinations[i](b)
      }
      if(out)
        return out
      else
        return a

    case "at":
      if(!a.stop || !a.trigger)
        throw "invalid use of 'at' operator"
      a.stop()
      //a.trigger()
      a.scheduleTrigger(b)
      return a

    case "!":
      if(!a.stop || !a.trigger)
        throw "invalid use of '!' operator"
      a.trigger()
      new components.Retriggerer(a, b)
      return a

    default:
      throw "Unknown operator: " + o.operator;
  }
}

module.exports = constructOperation
const quick = require("../quick")
const constructExpression = require("./constructExpression")
const components = require("../components")
const Repeater = require("../components/Repeater.js")
