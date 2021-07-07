import Patch from "../Patch.js"
import Mixer from "./Mixer.js"

class AttenuationMatrix extends Patch {
  constructor({
    nodes,
    pConnection=0.5,
    pMix=0.5,
    maxAmmount=1,
    minAmmount=0,
    maxMixAmmount=1,
    minMixAmmount=0,
    allowFeedback=true
  }) {
    super()
    var outMixer = new Mixer
    for(var i=0; i<nodes.length; i++) {
      var mixer = new Mixer()
      for(var j=0; j<nodes.length; j++) {
        if(j < i && !allowFeedback)
          continue
        if(Math.random() < pConnection) {
          var ammount = Math.random()*(maxAmmount-minAmmount) + minAmmount
          mixer.addAttenuated(nodes[j].OUT, ammount)
        }
      }
      if(mixer.numberOfInputs) {
        this.addUnits(mixer)
        nodes[i].IN = mixer
      }
      if(Math.random() < pMix) {
        var ammount = Math.random()*(maxMixAmmount-minMixAmmount) + minAmmount
        outMixer.addAttenuated(nodes[i].OUT, ammount)
      }
    }

    this.aliasInlet(nodes[0].IN, "in")
    this.aliasOutlet(outMixer.OUT, "out")
  }
}
export default AttenuationMatrix
