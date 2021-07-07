import Unit from "../../Unit.js"
import config from "../../config.js"
import Divide from "../Divide.js"
import shapeTables from "./shapeTables.js"


class Shape extends Unit {
  constructor(shape, durationInSeconds, min, max) {
    super()
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

  _tick() {
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

  get dusp() {
    return {

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

  trigger() {
    this.playing = true
    this.t = 0
    return this
  }
  stop() {
    this.playing = false
  }

  get shape() {
    return this._shape
  }
  set shape(shape) {
    this._shape = shape
    this.shapeTable = shapeTables[shape]
    this.shapeTableData = this.shapeTable.data
    if(!this.shapeTable)
      throw this.label + ":\n\tinvalid shape function: " + shape
  }

  get functions() {
    return { // btw: 0 >= x >= 1
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
  }

  static randomInRange(maxDuration, minMin, maxMax) {
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

  static randomShapeStr() {
    var keys = Object.keys(shapeTables)
    return keys[Math.floor(Math.random()*keys.length)]
  }

  static randomDecay(maxDuration) {
    return new Shape(
      "decaySquared",
      Math.random() * (maxDuration || 5),
    )
  }

  randomDecay(maxDuration) {
    this.shape = "decay"
    this.DURATION = Math.random() * (maxDuration || 5)
    this.MIN = 0
    this.MAX = 1
  }
}
export default Shape
