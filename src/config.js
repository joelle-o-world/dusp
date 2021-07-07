import minimist from 'minimist'

const argv = minimist(process.argv.slice(2))

const localConfig = {
  standardChunkSize: 256, // if < 256, Web Audio API will prang out
  sampleRate: 44100,
  channelFormat: "stereo",

  fft: {
    windowSize: 4096,
    hopSize: 4096/4,
    windowKind: "hamming",
  },

  useDuspShorthands: true,

  ...argv,
}

localConfig.sampleInterval = 1/localConfig.sampleRate

export default localConfig
