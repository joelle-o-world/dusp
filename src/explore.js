function* exploreConnections(...list) {
  // explore a circuit, yielding every new object found
  for(let i=0; i<list.length; i++) {
    let unit = list[i]
    if(unit.isPatch) {
      list.push(...unit.units)
      continue
    }
    yield unit

    list.push(...unit.neighbours.filter(u => !list.includes(u)))
  }
}
module.exports = exploreConnections

function exploreAndList(...startingPoints) {
  let list = []
  for(let unit of exploreConnections(...startingPoints))
    list.push(unit)

  return list
}
module.exports.all = exploreAndList

function checkConnection(unit, ...set) {
  // return true if the unit connected to any units in the set
  for(let u of exploreConnections(unit))
    if(set.includes(u))
      return true

  // if iterator ends then there is no connection
  return false
}
module.exports.checkConnection = checkConnection

function randomInlet(...list) {
  let all = [...exploreConnections(...list)]
    .filter(u => u.inletsOrdered.length)

  let unit = all[Math.floor(Math.random() * all.length)]
  return unit.randomInlet()
}
module.exports.randomInlet = randomInlet

function randomOutlet(...list) {
  let all = [...exploreConnections(...list)]
    .filter(u => u.outletsOrdered.length)

  let unit = all[Math.floor(Math.random() * all.length)]
  return unit.randomOutlet()
}
module.exports.randomOutlet = randomOutlet
