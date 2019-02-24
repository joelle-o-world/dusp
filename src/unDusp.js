const constructExpression = require("./construct/constructExpression.js")
//const parseExpression = require("./parseDSP/getExpression.js")

function unDusp(o) {
  if(o === null)
    return null
  if(o === undefined)
    return undefined
  if(o.constructor == String)
    return constructExpression(o)

  if(o.constructor == Number)
    return o
  if(o.isUnit || o.isOutlet || o.isPatch)
    return o
}
module.exports = unDusp
