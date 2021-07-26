import Patch from "../Patch.js";
import Repeater from "../components/Repeater.js";
import Sum from "../components/Sum.js";
import Multiply from "../components/Multiply.js";
import Gain from "../components/Gain.js";

class Mixer extends Patch {
  constructor(...inputs) {
    Patch.call(this);

    this.sums = [];
    this.inputs = [];

    this.addUnits((this.addRepeater = new Repeater(0)));

    this.aliasOutlet(this.addRepeater.OUT);

    for (var i in inputs) this.addInput(inputs[i]);
  }
  addInput(outlet) {
    if (!outlet.isOutlet && outlet.defaultOutlet) outlet = outlet.defaultOutlet;
    if (this.inputs.length == 0) {
      this.addRepeater.IN = outlet;
      this.inputs.push(outlet);
    } else if (this.inputs.length == 1) {
      var newSum = new Sum(this.addRepeater.IN.outlet, outlet);
      this.addRepeater.IN = newSum;
      this.inputs.push(outlet);
      this.sums.push(newSum);
    } else {
      var lastSum = this.sums[this.sums.length - 1];
      var lastInput = lastSum.B.outlet;
      var newSum = new Sum(lastInput, outlet);
      lastSum.B = newSum;
      this.inputs.push(outlet);
      this.sums.push(newSum);
    }
    return this;
  }
  addMultiplied(outlet, sf) {
    if (!sf) return this.addInput(outlet);
    else return this.addInput(new Multiply(outlet, sf));
  }
  addAttenuated(outlet, gain) {
    if (!gain) return this.addInput(outlet);
    var gainU = new Gain();
    gainU.IN = outlet;
    gainU.GAIN = gain;
    return this.addInput(gainU);
  }
  addInputs() {
    for (var i in arguments)
      if (arguments[i].constructor == Array)
        for (var j in arguments[i]) this.addInput(arguments[i][j]);
      else this.addInput(arguments[i]);
    return this;
  }
  removeInputByIndex(index) {
    if (index > this.units.length) {
      console.log(
        this.label,
        "can't remove input",
        index,
        "because it doesn't exist"
      );
    }
    if (this.inputs.length == 1 && index == 0) {
      this.addRepeater.IN = 0;
      this.inputs.shift();
    } else if (this.inputs.length > 0) {
      if (index == this.inputs.length - 1) {
        this.sums[this.sums.length - 1].collapseA();
        this.sums.splice(this.sums.length - 1, 1);
        this.inputs.splice(index, 1);
      } else {
        this.sums[index].collapseB();
        this.sums.splice(index, 1);
        this.inputs.splice(index, 1);
      }
    }
  }
  removeInput(outlet) {
    if (outlet == undefined) {
      console.log(this.label, "can't remove input:", outlet);
      return;
    }

    if (outlet.constructor == Number) return this.removeInputByIndex(outlet);
    if (outlet.isPatch || outlet.isUnit) outlet = outlet.defaultOutlet;
    if (outlet.isOutlet) {
      var index = this.inputs.indexOf(outlet);
      if (index == -1)
        console.log(
          this.label,
          "could not remove",
          outlet.label,
          "because it is not connected to it"
        );
      else this.removeInputByIndex(index);
    }
  }
  get numberOfInputs() {
    return this.inputs.length;
  }
}
export default Mixer;

