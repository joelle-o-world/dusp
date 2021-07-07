import Event from "./Event.js"

class UnitOrPatch {
  get isUnitOrPatch() {
    return true
  }

  schedule(time, func) {
    if(time.constructor == Array) {
      for(var i in time)
        this.schedule(time[i], func)
      return ;
    }
    var newEvent = new Event(
      time,
      func,
      this,
    )

    this.addEvent(newEvent)
    return this
  }

  scheduleTrigger(t, val) {
    if(!this.trigger)
      // perhaps this function belongs in Unit?
      this.schedule(t, function() {
        this.trigger(val)
      })
  }

  scheduleRelease() {
    if(this.release)
      this.schedule(t, function() {
        this.release(p, note)
      })
  }

  scheduleNote(note, semiquaverInSamples, t0) {
    semiquaverInSamples = semiquaverInSamples || 1/8
    t0 = t0 || 0
    var p = note.p
    var tOn = note.t*semiquaverInSamples + t0
    var tOff = note.tOff * semiquaverInSamples + t0
    if(!isNaN(tOn) && this.trigger)
      this.schedule(tOn, function() {
        this.trigger(p, note)
      })
    if(!isNaN(tOff) && this.release)
      this.schedule(tOff, function() {
        this.release(p, note)
      })
  }
  
  scheduleTrack(track, bpm, t0) {
    var bpm = bpm || track.bpm || 120
    var semiquaverInSamples = 60/4 / bpm
    var t0 = t0 || 0
    track = track.splitArraySounds()
    for(var i in track.notes) {
      this.scheduleNote(track.notes[i], semiquaverInSamples, t0)
    }
  }

  render(t) {
    if(this.defaultOutlet)
      return this.defaultOutlet.render(t)
    else
      throw this.label + " has no outlets. cannot render."
  }
  finish() {
    // _finish should be for unit specific implementations, onFinish could be used as an addition
    this.finished = true
    if(this._finish)
      this._finish()
    if(this.onFinish)
      this.onFinish()
  }
  scheduleFinish(t) {
  //  this.possiblyInfinite = false
    this.schedule(t, () => {
      this.finish()
    })
  }
}
export default UnitOrPatch






