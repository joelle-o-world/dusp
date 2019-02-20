const Piglet = require("./Piglet.js")
//const render = require("./render.js")

function Outlet(model) {
  Piglet.call(this, model)

  this.connections = []
}
Outlet.prototype = Object.create(Piglet.prototype)
Outlet.prototype.constructor = Outlet
module.exports = Outlet

Outlet.prototype.isOutlet = true

/*Outlet.prototype.render = async function(T) {
  return render(this, T)
}*/

Outlet.prototype.disconnect = function() {
  for(var i in this.connections)
    this.connections[i].disconnect()
}
