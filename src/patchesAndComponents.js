const patches = require("./patches")
const components = require("./components")

for(var name in patches)
  if(components[name])
    console.warn("A component and a patch with a common name:", name, "\nthe component will be overwritten")

Object.assign(exports, components, patches)
