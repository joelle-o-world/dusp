const Unit = require("../Unit.js")
const dusp = require("../dusp")

function Multiply(a, b) {
  Unit.call(this)
  this.addInlet("a")
  this.addInlet("b")
  this.addOutlet("out")

  this.A = a || 1
  this.B = b || 1
}
Multiply.prototype = Object.create(Unit.prototype)
Multiply.prototype.constructor = Multiply
Multiply.prototype.isMultiply = true
module.exports = Multiply

Multiply.prototype.dusp = {
  shorthand: function(index) {
    return "(" + dusp(this.A, index) + " * " + dusp(this.B, index) + ")"
  }
}

Multiply.prototype._tick = function(clock) {
  var outData = this.out
  var chunkSize = this.OUT.chunkSize
  for(var c=0; c<this.a.length || c<this.b.length; c++) {
    var aChan = this.a[c%this.a.length]
    var bChan = this.b[c%this.b.length]
    var outChan = outData[c] = outData[c] || new Float32Array(chunkSize)
    for(var t=0; t<chunkSize; t++) {
      outChan[t] = aChan[t] * bChan[t]
    }
  }
}
