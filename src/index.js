
/**
 * Root class for DUSP
 */
module.exports = {

  // useful functions
  unDusp: require('./unDusp'),
  dusp: require('./dusp'),
  renderChannelData: require("./renderChannelData"),
  renderAudioBuffer: require("./webaudioapi/renderAudioBuffer"),
  channelDataToAudioBuffer: require('./webaudioapi/channelDataToAudioBuffer'),
  connectToWAA: require("./webaudioapi/connectToWAA"),

  quick: require('./quick'),
  explore: require('./explore'),

  // basic elements
  Unit: require("./Unit"),
  Patch: require("./Patch"),
  Circuit: require("./Circuit"),

  components: require('./components'),
  patches: require('./patches'),

  // htmlInterface
  DuspPlayer: require('./webaudioapi/DuspPlayer')
}
