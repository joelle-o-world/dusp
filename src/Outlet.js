import Piglet from "./Piglet.js"
//const render = require("./render.js")

class Outlet extends Piglet {
  constructor(model) {
    Piglet.call(this, model)

    this.connections = []
  }

  get isOutlet() {
    return true
  }

/*Outlet.prototype.render = async function(T) {
  return render(this, T)
}*/

  disconnect() {
    for(var i in this.connections)
      this.connections[i].disconnect()
  }
}
export default Outlet
