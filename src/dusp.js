// reduce things to dusp
import config from "./config"

function dusp(o, index) {
  index = index || {}

  if(o === undefined)
    return undefined
  if(o === null)
    return null

  if(o === 0 || (o && o.constructor == Number))
    return o

  if(o && o.constructor == String)
    return duspString(o)

  if(o.isUnit) {
    // return a dusp representation of the unit
    if(index[o.label])
      return "#" + o.label
    else {
      index[o.label] = o

      if(config.useDuspShorthands) {
        var outputUnits = o.outputUnits
        var useShorthand = o.numberOfOutgoingConnections <= 1
        /*for(var i in outputUnits) {
          console.log("label:", outputUnits[i].label)
          if(!index[outputUnits[i].label]) {
            useShorthand = false
            break
          }
        }*/
      } else
        var useShorthand = false

      if(useShorthand)
        if(o.dusp && o.dusp.shorthand) {
          var possibleShorthand = o.dusp.shorthand.call(o, index)
          if(possibleShorthand)
            return possibleShorthand
        }

      var args = [o.constructor.name,]

      if(!useShorthand) {
        args.push("#" + o.label)
      }

      for(var i in o.inlets) {
        if(o.inlets[i].outlet)
          var value = duspOutlet(o.inlets[i].outlet, index)
        else
          var value = o.inlets[i].constant
        var attr = i.toUpperCase() + ":" + value
        args.push(attr)
      }

      if(o.dusp) {
        if(o.dusp.extraProperties)
          if(o.dusp.extraProperties.constructor == Array)
            for(var i in o.dusp.extraProperties) {
              var prop = o.dusp.extraProperties[i]
              args.push(prop + ":" + dusp(o[prop]))
            }
          else if(o.dusp.extraProperties.constructor == Object)
            for(var prop in o.dusp.extraProperties)
              if(o[prop] != o.dusp.extraProperties[prop])
                args.push(prop + ":" + dusp(o[prop]))


        if(o.dusp.extraArgs) {
          var extraArgs = o.dusp.extraArgs.call(o)
          if(extraArgs)
            args = args.concat(extraArgs)
        }
      }

      return "[" + args.join(" ") + "]"
    }
  }

  if(o.isOutlet)
    return duspOutlet(o, index)

  if(o.isInlet)
    return duspInlet(o, index)

  console.log(o.label)
  console.warn("unable to turn object to dusp: " + o)
  return null
}

export default dusp

// ???
dusp.usingShorthands = config.useDuspShorthands

function duspOutlet(o, index) {
  if(o == o.unit.defaultOutlet)
    return dusp(o.unit, index)

  var obdusp = dusp(o.unit, index)
  return obdusp + "." + o.name.toUpperCase()
}

function duspInlet(inlet, index) {
  if(inlet.connected)
    return dusp(inlet.outlet, index)
  else {
    if(inlet.constant.constructor == Number)
      return inlet.constant
    if(inlet.constant.constructor == Array)
      return "(" + inlet.constant.join(",") + ")"
    else throw "strange constant: " + inlet.constant
  }
}

function duspString(str, index) {
  return "\"" + str + "\""
}
