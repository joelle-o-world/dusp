import Patch from "../Patch";
import Noise from "../components/Noise";
import Filter from "../components/Filter";
import quick from "../quick";

class Worm extends Patch {
  constructor(f = 1) {
    super();

    this.addUnits(
      (this.noise = new Noise()),
      (this.filter = new Filter(this.noise, f))
    );

    this.aliasInlet(this.filter.F);
    this.aliasOutlet(this.filter.OUT);

    this.F = f;
  }

  static random(fMax = 5) {
    var f = quick.multiply(fMax, Math.random());
    return new Worm(f);
  }
}
export default Worm;
