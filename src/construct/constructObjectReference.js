function constructObjectReference(o, index) {
  if(o.constructor == String)
    o = parseObjectReference(o)

  let hashTag = '#'+o.id
  if(index[hashTag])
    return index[hashTag]
  else
    throw "Error: Referencing an object which has not been declared: #"+o.id
}
module.exports = constructObjectReference

const parseObjectReference = require("../parseDSP/getObjectReference.js")
