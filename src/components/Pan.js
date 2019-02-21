const Unit = require("../Unit.js")

function Pan(input, pan) {
  Unit.call(this)

  this.addInlet("in", {mono: true, type:"audio"})
  this.addInlet("pan", {mono: true, min:-1, max:1})
  this.addOutlet("out", {numberOfChannels:2, type:"audio"})

  this.PAN = pan || 0
  this.IN = input || 0
  this.compensationDB = 1.5
}
Pan.prototype = Object.create(Unit.prototype)
Pan.prototype.constructor = Pan
module.exports = Pan

Pan.prototype._tick = function() {
  for(var t=0; t<this.out[0].length; t++) {
    var compensation = dB((1-Math.abs(this.pan[t])) * this.compensationDB)
    this.out[0][t] = this.in[t] * (1-this.pan[t])/2 * compensation
    this.out[1][t] = this.in[t] * (1+this.pan[t])/2 * compensation
  }
}

function dB(db) { // decibel to scale factor (for amplitude calculations)
  return Math.pow(10, db/20);
}
