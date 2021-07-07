/* quick.js provides a set of operators for combining numbers or signals making
  efficiency savings where possible */

import Sum from "./components/Sum.js"
import Subtract from "./components/Subtract.js"
import Multiply from "./components/Multiply.js"
import Divide from "./components/Divide.js"
import PolarityInvert from "./components/PolarityInvert.js"
import SemitoneToRatio from "./components/SemitoneToRatio.js"
import ConcatChannels from "./components/ConcatChannels.js"
import Pow from "./components/Pow.js"
import HardClipAbove from "./components/HardClipAbove.js"
import HardClipBelow from "./components/HardClipBelow.js"

export function add(a,b) {
  if(a.constructor == Number && b.constructor == Number)
    return a + b
  else
    return new Sum(a, b)
}

export function subtract(a,b) {
  if(a.constructor == Number && b.constructor == Number)
    return a - b
  else
    return new Subtract(a, b)
}

export function mult(a, b) {
  if(a == undefined || a == null || a == 1)
    return b
  if(b == undefined || b == null || b == 1)
    return a
  if(a.constructor == Number && b.constructor == Number)
    return a * b
  else
    return new Multiply(a, b)
}
export function multiply(a, b) {
  return mult(a, b)
}

export function divide(a, b) {
  if(a.constructor == Number && b.constructor == Number)
    return a/b
  else
    return new Divide(a, b)
}

export function invert(a) {
  if(a.constructor == Number)
    return -a
  else
    return new PolarityInvert(a)
}

export function semitoneToRatio(p) {
  if(p.constructor == Number)
    return Math.pow(2, p/12);
  else
    return new SemitoneToRatio(p)
}
export function pToF(p) {
  if(p.constructor == Number) {
    return Math.pow(2, (p-69)/12) * 440
  } else
    throw "quick.pToF(non number) has not been implemented"
}

export function concat(a, b) {
  if(a.isUnitOrPatch || a.isOutlet || b.isUnitOrPatch || b.isOutlet)
    return new ConcatChannels(a, b)
  else
    return [].concat(a, b)
}

export function pow(a, b) {
  if(a.isUnitOrPatch || a.isOutlet || b.isUnitOrPatch || b.isOutlet)
    return new Pow(a,b)
  else
    return Math.pow(a, b)
}

export function clipAbove(input, threshold) {
  if(input.isUnitOrPatch || input.isOutlet || threshold.isUnitOrPatch || threshold.isOutlet)
    return new HardClipAbove(input, threshold)
  else // assume numbers
    if(input > threshold)
      return threshold
    else
      return input
}

export function clipBelow(input, threshold) {
  if(input.isUnitOrPatch || input.isOutlet || threshold.isUnitOrPatch || threshold.isOutlet)
    return new HardClipBelow(input, threshold)
  else // assume numbers
    if(input < threshold)
      return threshold
    else
      return input
}

export function clip(input, threshold) {
  if(input.isUnitOrPatch || input.isOutlet || threshold.isUnitOrPatch || threshold.isOutlet)
    return new Clip(input, threshold)
  else // assume numbers
    if(Math.abs(input) < Math.abs(threshold))
      return threshold
    else
      return input
}
