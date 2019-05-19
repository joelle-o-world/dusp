const components = require("../components")

module.exports = {
  O: function(frequency) {
    return new components.Osc(frequency)
  },

  Z: function(frequency) {
    var osc = new components.Osc(frequency)
    osc.waveform = "saw"
    return osc
  },
  Sq: function(frequency) {
    var osc = new components.Osc(frequency)
    osc.waveform = "square"
    return osc
  },

  Tri: function(frequency) {
    var osc = new components.Osc(frequency)
    osc.waveform = "triangle"
    return osc
  },
  Triangle: function(frequency) {
    var osc = new components.Osc(frequency)
    osc.waveform = "triangle"
    return osc
  },

  A: function(time) {
    return new components.Shape("attack", time).trigger()
  },
  D: function(time) {
    return new components.Shape("decay", time).trigger()
  },

  t: function() {
    return new components.Timer()
  },

  LP: function(freq) {
    return new components.Filter(null, freq)
  },

  HP: function(freq) {
    console.log('woo')
    return new components.Filter(null, freq, "HP")
  },

  AP: function(delaytime, feedback) {
    return new components.AllPass(delaytime, feedback)
  },

  random: function() {
    return Math.random()
  },
}
