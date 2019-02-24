/* quick.js provides a set of operators for combining numbers or signals making
  efficiency savings where possible */

const Sum = require("./components/Sum.js")
const Subtract = require("./components/Subtract.js")
const Multiply = require("./components/Multiply.js")
const Divide = require("./components/Divide.js")
const PolarityInvert = require("./components/PolarityInvert.js")
const SemitoneToRatio = require("./components/SemitoneToRatio.js")
const ConcatChannels = require("./components/ConcatChannels.js")
const Pow = require("./components/Pow.js")
const HardClipAbove = require("./components/HardClipAbove.js")
const HardClipBelow = require("./components/HardClipBelow.js")

exports.add = function(a,b) {
  if(a.constructor == Number && b.constructor == Number)
    return a + b
  else
    return new Sum(a, b)
}

exports.subtract = function(a,b) {
  if(a.constructor == Number && b.constructor == Number)
    return a - b
  else
    return new Subtract(a, b)
}

exports.mult = function(a, b) {
  if(a == undefined || a == null || a == 1)
    return b
  if(b == undefined || b == null || b == 1)
    return a
  if(a.constructor == Number && b.constructor == Number)
    return a * b
  else
    return new Multiply(a, b)
}
exports.multiply = exports.mult

exports.divide = function(a, b) {
  if(a.constructor == Number && b.constructor == Number)
    return a/b
  else
    return new Divide(a, b)
}

exports.invert = function(a) {
  if(a.constructor == Number)
    return -a
  else
    return new PolarityInvert(a)
}

exports.semitoneToRatio = function(p) {
  if(p.constructor == Number)
    return Math.pow(2, p/12);
  else
    return new SemitoneToRatio(p)
}
exports.pToF = function(p) {
  if(p.constructor == Number) {
    return Math.pow(2, (p-69)/12) * 440
  } else
    throw "quick.pToF(non number) has not been implemented"
}

exports.concat = function(a, b) {
  if(a.isUnitOrPatch || a.isOutlet || b.isUnitOrPatch || b.isOutlet)
    return new ConcatChannels(a, b)
  else
    return [].concat(a, b)
}

exports.pow = function(a, b) {
  if(a.isUnitOrPatch || a.isOutlet || b.isUnitOrPatch || b.isOutlet)
    return new Pow(a,b)
  else
    return Math.pow(a, b)
}

exports.clipAbove = function(input, threshold) {
  if(input.isUnitOrPatch || input.isOutlet || threshold.isUnitOrPatch || threshold.isOutlet)
    return new HardClipAbove(input, threshold)
  else // assume numbers
    if(input > threshold)
      return threshold
    else
      return input
}

exports.clipBelow = function(input, threshold) {
  if(input.isUnitOrPatch || input.isOutlet || threshold.isUnitOrPatch || threshold.isOutlet)
    return new HardClipBelow(input, threshold)
  else // assume numbers
    if(input < threshold)
      return threshold
    else
      return input
}

exports.clip = function(input, threshold) {
  if(input.isUnitOrPatch || input.isOutlet || threshold.isUnitOrPatch || threshold.isOutlet)
    return new Clip(input, threshold)
  else // assume numbers
    if(Math.abs(input) < Math.abs(threshold))
      return threshold
    else
      return input
}
