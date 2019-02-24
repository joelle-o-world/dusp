function constructExpressions(o, index) {
  if(o.constructor == String)
    o = parseExpressions(o)
  if(!o)
    return null

  console.log("o:", o)
  return o.expressions.map(expr => constructExpression(expr, index))
}

module.exports = constructExpressions
const parseExpressions = require("../parseDSP/getExpressions.js")
const constructExpression = require("./constructExpression")
