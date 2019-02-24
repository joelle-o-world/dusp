function constructNumber(o) {
  if(o.constructor == String)
    o = parseNumber(o)

  if(o.type != "number")
    return null

  return o.n
}

module.exports = constructNumber
const parseNumber = require("../parseDSP/getNumber.js")
