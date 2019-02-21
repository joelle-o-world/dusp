const Unit = require("../Unit.js")

function Repeater(val, measuredIn) {
  Unit.call(this)
  this.addInlet("in", {measuredIn:measuredIn})
  this.addOutlet("out", {measuredIn:measuredIn})
  this.measuredIn = measuredIn

  this.IN = val || 0
}
Repeater.prototype = Object.create(Unit.prototype)
Repeater.prototype.constructor = Repeater
module.exports = Repeater

Repeater.prototype.dusp = {
  extraArgs: function() {
    if(this.measuredIn)
      return ["\""+this.measuredIn+"\""]
    else return null
  }
}

Repeater.prototype._tick = function() {
  for(var c=0; c<this.in.length; c++) {
    this.out[c] = this.out[c] || new Float32Array(this.in[c].length)

    for(var t=0; t<this.in[c].length; t++)
      this.out[c][t] = this.in[c][t]
  }
}
