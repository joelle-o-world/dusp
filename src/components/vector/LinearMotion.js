const Unit = require("../../Unit.js")
const config = require("../../config.js")

function LinearMotion(a, b, duration) {
  Unit.call(this)

  this.addInlet("a")
  this.addInlet("b")
  this.addInlet("duration", {mono: true})
  this.addOutlet("out")

  this.A = a || [0,0]
  this.B = b || [0,0]
  this.DURATION = duration || 1

  this.progress = 0
  this.playing = true
}
LinearMotion.prototype = Object.create(Unit.prototype)
LinearMotion.prototype.constructor = LinearMotion
module.exports = LinearMotion

LinearMotion.random = function(maxSize, maxDuration) {
  maxSize = maxSize || 10
  maxDuration = maxDuration || 10
  var motion = new LinearMotion(
    [
      (Math.random()*2-1) * maxSize,
      (Math.random()*2-1) * maxSize,
    ],
    [
      (Math.random()*2-1) * maxSize,
      (Math.random()*2-1) * maxSize,
    ],
    Math.random() * maxDuration,
  )
  return motion
}

LinearMotion.prototype._tick = function() {
  var chunkSize = this.OUT.chunkSize

  var progress = new Float32Array(chunkSize)

  for(var t=0; t<chunkSize; t++) {
    if(this.playing && this.progress>=0 && this.progress<1)
      this.progress += config.sampleInterval / this.duration[t]
    progress[t] = this.progress
  }

  for(var c=0; c<this.a.length || c<this.b.length; c++) {
    var out = this.out[c] = this.out[c] || new Float32Array(chunkSize)
    var a = this.a[c] || new Float32Array(chunkSize)
    var b = this.b[c] || new Flaot32Array(chunkSize)
    for(var t=0; t<chunkSize; t++)
      out[t] = a[t] * (1-progress[t]) + b[t] * progress[t]
  }
}
