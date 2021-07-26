import Unit from "../Unit.js";

class Timer extends Unit {
  constructor() {
    super();
    this.addOutlet("out", { mono: true });

    this.t = 0;
    this.samplePeriod = 1 / this.sampleRate;
  }

  _tick() {
    for (var t = 0; t < this.out.length; t++) {
      this.t += this.samplePeriod;
      this.out[t] = this.t;
    }
  }

  trigger() {
    this.t = 0;
  }
}
export default Timer;
