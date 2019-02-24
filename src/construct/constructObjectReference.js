function constructObjectReference(o, index) {
  if(o.constructor == String)
    o = parseObjectReference(o)

  if(index[o.id])
    return index[o.id]
  else
    throw "Error: Referencing an object which has not been declared: #"+o.id
}
module.exports = constructObjectReference

const parseObjectReference = require("../parseDSP/getObjectReference.js")
