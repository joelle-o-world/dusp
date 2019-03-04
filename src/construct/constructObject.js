

function constructObject(o, index) {
  index = index || {}
  if(o.constructor == String)
    o = parseObject(o)

  if(o.type != "object")
    return null

  var constructor = components[o.constructor]
  if(!constructor)
    throw "Unknown object constructor: "+o.constructor
  var args = o.arguments.map(constructExpression)

  /*var obj = Object.create(constructor.prototype)
  constructor.apply(obj, args)*/
  var obj = new constructor(...args)
  if(o.id)
    obj.label = o.id

  let idTag = '#'+obj.label
  if(index[idTag]) {
    if(index[idTag] != obj)
      throw "Duplicate objects for id:", obj.label
  } else
    index[idTag] = obj

  for(var i in o.attributes) {
    var arg = o.attributes[i]
    var property = arg.property
    var upperCaseProperty = property.toUpperCase()
    if(obj[upperCaseProperty] && obj[upperCaseProperty].isInlet)
      property = upperCaseProperty
    if(arg.type == "attribute")
      obj[property] = constructExpression(arg.value, index)
    else
      throw "unknown argument type: ", arg.type
  }

  if(obj.dusp && obj.dusp.flagFunctions)
    for(var i in o.flags) {
      var flag = o.flags[i].flag
      var func = obj.dusp.flagFunctions[flag]
      if(func)
        func.call(obj)
    }




  return obj
}

module.exports = constructObject
const parseObject = require("../parseDSP/getObject.js")
const components = require("../patchesAndComponents")
const constructExpression = require("./constructExpression")
