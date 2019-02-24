function constructObjects(o, index) {
  if(o.constructor == String)
    o = parseObjects(o)

  return o.objects.map(obj => constructObject(obj, index))
}

module.exports = constructObjects
const parseObjects = require("../parseDSP/getObjects.js")
const constructObject = require("./constructObject")
