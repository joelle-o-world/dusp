const Unit = require("../../Unit.js")
const config = require('../../config.js')

const phiOverSampleRate = 2*Math.PI/config.sampleRate

function CircularMotion(f, r, centre) {
  Unit.call(this)
  this.addInlet("f", {mono: true})
  this.addInlet("radius", {mono: true})
  this.addInlet("centre", 2)
  this.addOutlet("out", 2)

  this.phase = 0
  this.F = f || 1
  this.RADIUS = r || 1
  this.CENTRE = centre || [0, 0]
}
CircularMotion.prototype = Object.create(Unit.prototype)
CircularMotion.prototype.constructor = CircularMotion
module.exports = CircularMotion

CircularMotion.prototype._tick = function() {
  for(var t=0; t<this.f.length; t++) {
    this.phase += this.f[t] * phiOverSampleRate
    this.out[0][t] = Math.sin(this.phase) * this.radius[t] + this.centre[0][t]
    this.out[1][t] = Math.cos(this.phase) * this.radius[t] + this.centre[1][t]
  }
}

CircularMotion.random = function(fMax, rMax, oMax) {
  var circ = new RotatingAmbient(
    Math.random() * (fMax || 2),
    Math.random() * (rMax || 5),
    [
      (Math.random()*2-1) * (oMax || 5),
      (Math.random()*2-1) * (oMax || 5),
    ],
  )
  circ.phase = Math.random()*2*Math.PI
  return circ
}
