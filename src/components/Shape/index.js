const Unit = require("../../Unit.js")
const config = require("../../config.js")
const Divide = require("../Divide.js")
const shapeTables = require("./shapeTables.js")


function Shape(shape, durationInSeconds, min, max) {
  Unit.call(this)
  this.addInlet("duration", {mono: true, type:"time", measuredIn:"s"})
  this.addInlet("min", {mono: true, type:"scalar"})
  this.addInlet("max", {mono: true, type:"scalar"})
  this.addOutlet("out", {mono: true, type:"control", min:0, max:1})

  this.t = 0

  this.playing = false
  this.leftEdge = 0
  this.rightEdge = "shape"
  this.shape = shape || "decay"
  this.DURATION = durationInSeconds || 1
  this.MIN = min || 0
  this.MAX = max || 1
}
Shape.prototype = Object.create(Unit.prototype)
Shape.prototype.constructor = Shape
module.exports = Shape

Shape.prototype._tick = function() {
  for(var t=0; t<this.out.length; t++) {

    if(this.playing)
      this.t += 1/this.duration[t]

    if(this.t <= 0) {
      if(this.leftEdge == "shape")
        this.out[t] = this.shapeTableData[0] * (this.max[t]-this.min[t]) + this.min[t]
      if(this.leftEdge.constructor == Number)
        this.out[t] = this.leftEdge * (this.max[t]-this.min[t]) + this.min[t]

    } else if(this.t > config.sampleRate) {
      if(!this.finished)
        this.finish()

      if(this.rightEdge == "shape") {
        this.out[t] = this.shapeTableData[config.sampleRate] * (this.max[t]-this.min[t]) + this.min[t]
      }
      else if(this.rightEdge.constructor == Number)
        this.out[t] = this.rightEdge * (this.max[t]-this.min[t]) + this.min[t]

    } else {
      this.out[t] =
      this.min[t] + ((this.max[t]-this.min[t])) *
        (
          this.shapeTableData[Math.ceil(this.t)] * (this.t%1) +
          this.shapeTableData[Math.floor(this.t)] * (1-this.t%1)
        )
    }
  }
}

Shape.prototype.dusp = {

  flagFunctions: {
    trigger: function() {
      this.trigger()
    },
  },

  extraArgs: function() {
    var args = []
    if(this.playing)
      args.push("trigger")
    return args
  },

  extraProperties: ["shape"],
}

/*Shape.prototype.flagFunctions = {
  trigger: function() {
    this.trigger()
  }
}
Shape.prototype.extraDuspArgs = function() {
  var args = []
  if(this.playing)
    args.push("trigger")
  return args
}
Shape.prototype.extraDuspProperties = ["shape"]*/

Shape.prototype.trigger = function() {
  this.playing = true
  this.t = 0
  return this
}
Shape.prototype.stop = function() {
  this.playing = false
}

Shape.prototype.__defineGetter__("shape", function() {
  return this._shape
})
Shape.prototype.__defineSetter__("shape", function(shape) {
  this._shape = shape
  this.shapeTable = shapeTables[shape]
  this.shapeTableData = this.shapeTable.data
  if(!this.shapeTable)
    throw this.label + ":\n\tinvalid shape function: " + shape
})

Shape.functions = { // btw: 0 >= x >= 1
  decay: function(x) {
    return 1-x
  },
  attack: function(x) {
    return x
  },
  semiSine: function(x) {
    return Math,sin(Math.PI * x)
  }
}

Shape.randomInRange = function(maxDuration, minMin, maxMax) {
  maxDuration = maxDuration || 1

  var a = minMin + Math.random() * (maxMax-minMin)
  var b = minMin + Math.random() * (maxMax-minMin)
  if(a > b) {
    var min = b
    var max = a
  } else {
    var min = a
    var max = b
  }

  return new Shape(
    Shape.randomShapeStr(),
    Math.random()*maxDuration,
    min,
    max,
  )
}

Shape.randomShapeStr = function() {
  var keys = Object.keys(shapeTables)
  return keys[Math.floor(Math.random()*keys.length)]
}

Shape.randomDecay = function(maxDuration) {
  return new Shape(
    "decaySquared",
    Math.random() * (maxDuration || 5),
  )
}

Shape.prototype.randomDecay = function(maxDuration) {
  this.shape = "decay"
  this.DURATION = Math.random() * (maxDuration || 5)
  this.MIN = 0
  this.MAX = 1
}
