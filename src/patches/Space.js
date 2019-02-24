const Patch = require("../Patch.js")
const SpaceChannel = require("./SpaceChannel.js")
const PickChannel = require("../components/PickChannel.js")
const ConcatChannels = require("../components/ConcatChannels.js")
const Repeater = require("../components/Repeater.js")
const config = require("../config.js")

function Space(input, place) {
  Patch.call(this)

  this.addUnits(
    this.signalIn = new Repeater(),
    this.placementIn = new Repeater(),
    this.outRepeater = new Repeater(),
  )
  this.spaceChannels = []

  this.alias(this.signalIn.IN)
  this.alias(this.placementIn.IN, "placement")
  this.alias(this.outRepeater.OUT)

  this.IN = input || 0
  this.PLACEMENT = place || [0, 0]

  switch(config.channelFormat) {

    case "stereo":
      this.addSpeaker([-1, 0])
      this.addSpeaker([1,0])
      break;

    case "surround":
      this.addSpeaker([-1, 1])
      this.addSpeaker([1,1])
      this.addSpeaker([0, Math.sqrt(2)])
      this.addSpeaker([0,0])
      this.addSpeaker([-1,-1])
      this.addSpeaker([1,-1])
      break;
  }
}
Space.prototype = Object.create(Patch.prototype)
Space.prototype.constructor = Space
module.exports = Space

Space.stereo = function(input, place) {
  var space = new Space(input, place)
  space.addSpeaker([-1, 0])
  space.addSpeaker([ 1, 0])
  return space
}

Space.prototype.addSpeaker = function(speakerPosition) {
  var chan = new SpaceChannel()
  chan.SPEAKERPOSITION = speakerPosition
  chan.PLACEMENT = this.placementIn.OUT
  chan.IN = this.signalIn //new PickChannel(this.signalIn, this.spaceChannels.length)
  if(this.outRepeater.IN.connected)
    this.outRepeater.IN = new ConcatChannels(this.outRepeater.IN.outlet, chan)
  else
    this.outRepeater.IN = chan
  this.spaceChannels.push(chan)
  this.addUnit(chan)
}
