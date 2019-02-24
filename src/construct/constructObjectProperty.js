function constructObjectProperty(o, index) {
  var obj = constructExpression(o.object, index)
  return obj[o.property]
}

module.exports = constructObjectProperty
const constructExpression = require("./constructExpression")
