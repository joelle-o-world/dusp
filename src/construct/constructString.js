function constructString(o, index) {
  if(o.constructor == String)
    o = parseString(o)
  if(!o)
    return null

  if(o.type == "string")
    return o.string

  return null
}

module.exports = constructString
const parseString = require("../parseDSP/getString.js")
