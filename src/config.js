const argv = require("minimist")(process.argv.slice(2))

var localConfig = {}

Object.assign(localConfig, {
  standardChunkSize: 256, // if < 256, Web Audio API will prang out
  sampleRate: 44100,
  channelFormat: "stereo",

  fft: {
    windowSize: 4096,
    hopSize: 4096/4,
    windowKind: "hamming",
  },

  useDuspShorthands: true,
}, argv)


localConfig.sampleInterval = 1/module.exports.sampleRate

module.exports = localConfig
