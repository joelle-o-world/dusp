const argv = require("minimist")(process.argv.slice(2))
const fs = require("fs")
const construct = require("../construct")
const Sample = require("../Sample")
const quick = require("../quick")
const components = require("../components")

const str = "O50"//fs.readFileSync("dsp3/construct/example.patch", "utf-8")
var sounds = []

async function go(str) {
  var circuit = construct(str)
  //console.log(circuit.unconnectedInlets({}).map(inlet => inlet.label +": "+ inlet.constant))

  function tweak(circuit) {
    switch(Math.floor(Math.random()*3)) {
      case 0:
        var inlet = circuit.randomInlet()
        console.log("tweaking", inlet.label)
        inlet.set(quick.multiply(inlet.get(), Math.random()*2))
        break

      case 1:
        var inlet = circuit.randomInlet()
        console.log("adding random osc to", inlet.label)
        var osc = quick.multiply(
          new components.Osc(Math.random() * 200),
          Math.random() * 100
        )
        inlet.set(quick.add(inlet.get(), osc))
        break

      case 2:
        var inlet = circuit.randomInlet()
        var outlet = circuit.randomOutlet()
        console.log("randomly connecting", inlet.label, "to", outlet.label)
        inlet.set(quick.add(inlet.get(), quick.multiply(outlet, Math.random())))
        break
    }
  }

  for(var i=0; i<2; i++)
    tweak(circuit)
    //

  tape = await circuit.lastDuspExpression.OUT.render(argv.t || 1)
  tape
    .normalise()
    .fadeOutSelf(tape.lengthInSamples)
    //.save("testing tweak", "dumb tests")
  sounds.push(tape)


  return tape.meta.dusp
}


async function goMany(str, n) {
  n = n || 1

  var strings = [str]
  var j = 0
  for(var i=0; i<n; i++)
    try {
      strings[j+1] = await go(strings[j], n-1)
      j++
      if(Math.random() < 0.05)
        j = Math.floor(Math.random()*strings.length)
    } catch(e) {
     j = Math.floor(Math.random()*strings.length)
     continue
   }

  console.log(sounds.length)
  Sample.concat(sounds).save("Testing Tweak", "dumb tests")
}

goMany(str, argv.n || 10)
