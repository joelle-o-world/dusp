// A butterworth filter

const Unit = require("../Unit.js")

function Filter(input, f, kind) {
  Unit.call(this)

  this.addInlet("in", {type:"audio"})
  this.addInlet("f", {mono: true, measuredIn:"Hz"})
  this.addOutlet("out", {type:"audio"})

  if(input)
    this.IN = input
  if(f)
    this.F = f
  this.kind = kind || "LP"

  this.x1 = [] // input delayed by one samples for each channel
  this.x2 = [] // input delated by two samples for each channel
  this.y1 = [] // output delayed by one samples for each channel
  this.y2 = [] // output delayed by two samples for each channel
}
Filter.prototype = Object.create(Unit.prototype)
Filter.prototype.constructor = Filter
module.exports = Filter

Filter.prototype._tick = function() {
  var numberOfChannels = this.in.length
  var chunkSize = this.IN.chunkSize

  while(this.out.length < this.in.length)
    this.out.push(new Float32Array(this.OUT.chunkSize))
  for(var t=0; t<chunkSize; t++) {
    if(this.f[t] != this.lastF) {
      this.lastF = this.f[t]
      this.calculateCoefficients(this.f[t])
    }
    for(var c=0; c<numberOfChannels; c++) {
      //this.out[c][t] = this.a0 * this.in[c][t] - this.a2 * (this.x2[c] || 0) - this.b1 * (this.y1[c] || 0) - this.b2 * (this.y2[c] || 0) /*
      this.out[c][t] = this.a0 * this.in[c][t]
                      + this.a1 * (this.x1[c] || 0)
                      + this.a2 * (this.x2[c] || 0)
                      - this.b1 * (this.y1[c] || 0)
                      - this.b2 * (this.y2[c] || 0)//*/
      this.y2[c] = this.y1[c] || 0
      this.y1[c] = this.out[c][t]
      this.x2[c] = this.x1[c] || 0
      this.x1[c] = this.in[c][t]
    }
  }

}

Filter.prototype.__defineGetter__("kind", function() {
  return this._kind
})
Filter.prototype.__defineSetter__("kind", function(kind) {
  this.calculateCoefficients = Filter.coefficientFunctions[kind]
  if(!this.calculateCoefficients)
    throw "invalid filter type: " + kind
  this._kind = kind
  this.calculateCoefficients()
})

Filter.coefficientFunctions = {
  LP: function(f) {
    var lamda = 1/Math.tan(Math.PI * f/this.sampleRate)
    var lamdaSquared = lamda * lamda
    this.a0 = 1/(1 + 2*lamda + lamdaSquared)
    this.a1 = 2 * this.a0
    this.a2 = this.a0
    this.b1 = 2 * this.a0 * (1 - lamdaSquared)
    this.b2 = this.a0 * (1 - 2 * lamda + lamdaSquared)
  },
  HP: function(f) {
    var lamda = Math.tan(Math.PI * f / this.sampleRate) // checked
    var lamdaSquared = lamda * lamda // checked
    this.a0 = 1/(1 + 2*lamda + lamdaSquared) // checked
    this.a1 = 0//2 * this.a0 //checked
    this.a2 = -this.a0 // checked
    this.b1 = 2 * this.a0 * (lamdaSquared-1)
    this.b2 = this.a0 * (1 - 2*lamda + lamdaSquared)
  },
  BP: function(f, bandwidth) {
    var lamda = 1/Math.tan(Math.PI * bandwidth/this.sampleRate)
    var phi = 2 * Math.cos(2*Math.PI * f/this.sampleRate)
    this.a0 = 1/(1+lamda)
    this.a1 = 0
    this.a2 = -this.a0
    this.b1 = - lamda * phi * this.a0
    this.b2 = this.a0 * (lamda - 1)
  },
  BR: function(f, bandwidth) {
    var lamda = Math.tan(Math.PI * bandwidth/this.sampleRate)
    var phi = 2 * Math.cos(2*Math.PI * f/this.sampleRate)
    this.a0 = 1/(1+lamda)
    this.a1 = - phi * this.a0
    this.a2 = this.a0
    this.b1 = - phi * this.a0
    this.b2 = this.a0 * (lamda - 1)
    console.log(f, this)
  },
}
