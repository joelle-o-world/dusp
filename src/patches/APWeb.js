import Patch from "../Patch"
import AttenuationMatrix from "./AttenuationMatrix.js"
import AllPass from "../components/AllPass.js"

class APWeb extends Patch {
  constructor(n=4, maxDelay=0.01, maxFeedback=0.1) {
    super()
    var list = AllPass.manyRandom(n, maxDelay, maxFeedback)
      //.map(ap => {return {"IN":ap.IN, "OUT":ap.OUT}})

    var matrix = new AttenuationMatrix({
      nodes:list,
      //maxAmmount: 0.1,
      //pConnection: 0.1,
      allowFeedback:false,
      pMix:1,        
    })
    this.addUnits(matrix)
    console.log(matrix.IN)
    this.aliasInlet(matrix.IN, "in")
    this.aliasOutlet(matrix.OUT, "out")
  }
}
export default APWeb
