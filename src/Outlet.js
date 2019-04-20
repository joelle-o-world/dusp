const Piglet = require("./Piglet.js")

/**
 * Used for feeding signals out of a Unit. May be connected to any number of inlets
 * @extends Piglet
 */
class Outlet extends Piglet {
  /**
   * Outlet constructor
   * @param {object} model
   */
  constructor(model) {
    super(model)

    /**
     * List of inlets connected to this outlet
     */
    this.connections = []
  }

  /**
   * Remove all routings from this outlet.
   */
  disconnect() {
    for(var connection of this.connections)
      connection.disconnect()
  }
}
Outlet.prototype.isOutlet = true
module.exports = Outlet
