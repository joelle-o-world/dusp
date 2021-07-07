import Patch from "../Patch.js"
import AllPass from "../components/AllPass.js"

class APStack extends Patch {
  constructor(n=4, maxDelay=0.1, maxFeedback=0.5) {
    super()
    var ap = null
    var last = null
    var stack = AllPass.manyRandom(n, maxDelay, maxFeedback)
    for(var i=1; i<stack.length; i++)
      stack[i].IN = stack[i-1]

    /*[]
    for(var i=0; i<n; i++) {
      var delay = 2/this.sampleRate + Math.random()*(maxDelay-2/this.sampleRate)
      while(delay == 0)
        var delay = Math.random()*maxDelay

      ap = new AllPass(Math.random()*maxDelay, Math.random()*maxFeedback)
      if(last)
        ap.IN = last
      last = ap
      stack.push(ap)
    }*/

    this.addUnits(stack)

    this.aliasInlet(stack[0].IN, "in")
    this.aliasOutlet(stack[stack.length-1].OUT, "out")
  }
}
export default APStack
