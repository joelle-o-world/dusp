import Patch from "../Patch"
import SpaceChannel from "./SpaceChannel"
import PickChannel from "../components/PickChannel"
import ConcatChannels from "../components/ConcatChannels"
import Repeater from "../components/Repeater"
import config from "../config"

class Space extends Patch {
  constructor(input, place) {
    super()

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

  static stereo(input, place) {
    var space = new Space(input, place)
    space.addSpeaker([-1, 0])
    space.addSpeaker([ 1, 0])
    return space
  }

  addSpeaker(speakerPosition) {
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
}
export default Space
