// This is a placeholder function

function construct(str, index) {
  index = index || {}

  var expressions = constructExpressions(str, index)

  var circuit = new Circuit
  for(var i in expressions) {
    var expression = expressions[i]
    if(expression.isUnit)
      circuit.add(expression)
    else
      console.log(expression)
  }

  if(expressions.length == 0)
    return null

  circuit.lastDuspExpression = expressions[expressions.length-1]

  return circuit
}

module.exports = construct
const constructExpressions = require("./constructExpressions")
const Circuit = require("../Circuit")
