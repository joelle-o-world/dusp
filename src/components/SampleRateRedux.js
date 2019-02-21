const Unit = require("../Unit.js")

function SampleRateRedux(input, ammount) {
  Unit.call(this)
  this.addInlet("in")
  this.addInlet("ammount", {mono: true})
  this.addOutlet("out")

  this.val = [0]
  this.timeSinceLastUpdate = Infinity


  this.IN = input || 0
  this.AMMOUNT = ammount || 0
}
SampleRateRedux.prototype = Object.create(Unit.prototype)
SampleRateRedux.prototype.constructor = SampleRateRedux
module.exports = SampleRateRedux

SampleRateRedux.prototype._tick = function() {
  var chunkSize = this.OUT.chunkSize
  while(this.out.length < this.in.length)
    this.out.push( new Float32Array(chunkSize) )
  for(var t=0; t<chunkSize; t++) {
    this.timeSinceLastUpdate++
    if(this.timeSinceLastUpdate > this.ammount[t]) {
      this.val = []
      for(var c=0; c<this.in.length; c++)
        this.val[c] = this.in[c][t]
      this.timeSinceLastUpdate = 0
    }
    for(var c=0; c<this.val.length; c++) {
      this.out[c][t] = this.val[c]
    }
  }
}
