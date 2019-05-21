const {quick, components, explore, unDusp, dusp} = require('../src/')
const entify = require('../../english-dusp-interface/src/entify')
const renderAudioBuffer = require('../src/webaudioapi/renderAudioBuffer')
const Promise = require('bluebird')
const io = require('english-io')
console.log(io)

function tweakCircuit(someUnit) {
  let inlet, outlet
  switch(Math.floor(Math.random()*3)) {
    case 0:
      // Scale value of an inlet by a constant 0-2
      inlet = explore.randomInlet(someUnit)
      // console.log("tweaking", inlet.label)
      inlet.set(quick.multiply(inlet.get(), Math.random()*2))
      break

    case 1:
      // Add an oscillator to the input of some inlet
      inlet = explore.randomInlet(someUnit)
      // console.log("adding random osc to", inlet.label)
      var osc = quick.multiply(
        new components.Osc(Math.random() * 200),
        Math.random() * 100
      )
      inlet.set(quick.add(inlet.get(), osc))
      break

    case 2:
      // Make a random connection within the patch
      inlet = explore.randomInlet(someUnit)
      outlet = explore.randomOutlet(someUnit)
      // console.log("randomly connecting", inlet.label, "to", outlet.label)
      inlet.set(quick.add(inlet.get(), quick.multiply(outlet, Math.random())))
      break
  }
}



const dusp0 = 'O440'
const circuit = unDusp(dusp0)

let entity1 = entify(circuit)

let ctx = new io.DescriptionContext()

let oldFacts = []
function getChanges(circuit) {
  let domain = [...io.search.explore([entity1])]
  let newFacts = []
  for(let e of domain) {
    for(let fact of e.facts) {
      if(!oldFacts.includes(fact)) {
        oldFacts.push(fact)
        newFacts.push(fact)
      }
    }
  }

  return newFacts
    .map(fact => fact.str('simple_past', ctx))
    .map(str => io.sentencify(str))
    .join(' ')
}

let iterations = [{
  dusp: dusp(circuit),
  description: getChanges(circuit),
}]

let nextPatch = () => {
  tweakCircuit(circuit)

  iterations.push({
    dusp: dusp(circuit),
    description: getChanges(circuit),
  })
}

for(let i=0; i<10; i++)
  nextPatch()




window.go = async function(voiceIndex = 12) {

  let actx = new AudioContext

  let voice = window.speechSynthesis.getVoices()[voiceIndex]
  console.log(window.speechSynthesis.getVoices())
  for(let iter of iterations) {
    let utterance = new SpeechSynthesisUtterance(iter.description)
    utterance.pitch = 1.5
    //utterance.rate = 0.75
    console.log(voice)
    utterance.voice = voice
    iter.utterance = utterance
    let audiobuffer = await renderAudioBuffer(unDusp(iter.dusp), 3)
    iter.buffer = audiobuffer
  }

  for(let {utterance, buffer, description} of iterations) {

    console.log(description)
    console.log(utterance)

    await new Promise(fulfil => {
      utterance.onend = () => fulfil()
      window.speechSynthesis.speak(utterance)
    })

    await new Promise(fulfil => {
      let source = actx.createBufferSource()
      source.buffer = buffer
      source.onended = () => fulfil()
      source.connect(actx.destination)
      source.start()
    })
  }
}
