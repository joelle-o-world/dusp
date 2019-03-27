const AudioBuffer = require('audio-buffer')
const Circuit = require('./Circuit')

// render audio into an channelData (array of typed arrays)
async function renderChannelData(outlet,
                                 duration=1,
                                 { TypedArray = Float32Array,
                                   normalise = false, // (unimplemented)
                                   audioctx = null,
                                 } = {}) {
  // check arguments
  if(!outlet)
    throw "renderAudioBuffer expects an outlet"
  if(outlet.isUnit || outlet.isPatch)
    outlet = outlet.defaultOutlet
  if(!outlet.isOutlet)
    throw "renderAudioBuffer expects an outlet"

  // find or construct the circuit
  const circuit = outlet.unit.circuit || new Circuit(outlet.unit)

  // get values
  const sampleRate = outlet.sampleRate
  const lengthInSamples = duration * sampleRate
  const chunkSize = outlet.chunkSize

  const channelData = [] // record data; channelData[channel][timeInSamples]

  for(let t0=0; t0<lengthInSamples; t0+=chunkSize) {
    // "tick" the circuit
    let t1 = t0 + chunkSize
    await circuit.tickUntil(t1)

    // the output signal chunk
    let chunk = outlet.signalChunk

    // if necessary, increase numberOfChannels to accomodate signal
    while(chunk.channelData.length > channelData.length)
      channelData.push(new TypedArray(lengthInSamples))

    // record signal chunk to channelData
    for(let channel in chunk.channelData)
      for(let t=0; t<chunkSize; t++) {
        let val = chunk.channelData[channel][t]
        if(isNaN(val)) {
          let culprit = circuit.findNaNCulprit()
          console.log('NaN culprit:', culprit.label)
          throw 'cannot record NaN value'
        }
        channelData[channel][t+t0] = val || 0
      }
  }

  channelData.sampleRate = sampleRate
  return channelData
}

module.exports = renderChannelData
