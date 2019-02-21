const components = require("./component_index.json")

function assignAutoLoader(obj, name) {
  obj.__defineGetter__(name, function() {
    delete obj[name]
    obj[name] = require("./" + components[name])
    return obj[name]
  })
}

for(var i in components)
  assignAutoLoader(exports, i)
