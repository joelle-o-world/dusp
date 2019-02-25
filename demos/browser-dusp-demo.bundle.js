(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
const unDusp = require('../src/unDusp')
const connectToWAA = require("../src/connectToWAA")

const ctx = new AudioContext()
window.AUDIOCTX = ctx

let nowPlayingRenderStream = null

console.log(unDusp)

window.onload = function() {
  document.getElementById("user-input").onkeypress = function(e) {
    if(e.keyCode == 13) {
      play(this.value)
    }
  }
}

function play(str) {
  if(nowPlayingRenderStream)
    nowPlayingRenderStream.end()
  let unit = unDusp(str)
  if(!unit)
    throw "Some problem with the input"

  let outlet = unit.defaultOutlet
  connectToWAA(outlet, ctx.destination)
}

},{"../src/connectToWAA":123,"../src/unDusp":194}],2:[function(require,module,exports){
"use strict";

// rawAsap provides everything we need except exception management.
var rawAsap = require("./raw");
// RawTasks are recycled to reduce GC churn.
var freeTasks = [];
// We queue errors to ensure they are thrown in right order (FIFO).
// Array-as-queue is good enough here, since we are just dealing with exceptions.
var pendingErrors = [];
var requestErrorThrow = rawAsap.makeRequestCallFromTimer(throwFirstError);

function throwFirstError() {
    if (pendingErrors.length) {
        throw pendingErrors.shift();
    }
}

/**
 * Calls a task as soon as possible after returning, in its own event, with priority
 * over other events like animation, reflow, and repaint. An error thrown from an
 * event will not interrupt, nor even substantially slow down the processing of
 * other events, but will be rather postponed to a lower priority event.
 * @param {{call}} task A callable object, typically a function that takes no
 * arguments.
 */
module.exports = asap;
function asap(task) {
    var rawTask;
    if (freeTasks.length) {
        rawTask = freeTasks.pop();
    } else {
        rawTask = new RawTask();
    }
    rawTask.task = task;
    rawAsap(rawTask);
}

// We wrap tasks with recyclable task objects.  A task object implements
// `call`, just like a function.
function RawTask() {
    this.task = null;
}

// The sole purpose of wrapping the task is to catch the exception and recycle
// the task object after its single use.
RawTask.prototype.call = function () {
    try {
        this.task.call();
    } catch (error) {
        if (asap.onerror) {
            // This hook exists purely for testing purposes.
            // Its name will be periodically randomized to break any code that
            // depends on its existence.
            asap.onerror(error);
        } else {
            // In a web browser, exceptions are not fatal. However, to avoid
            // slowing down the queue of pending tasks, we rethrow the error in a
            // lower priority turn.
            pendingErrors.push(error);
            requestErrorThrow();
        }
    } finally {
        this.task = null;
        freeTasks[freeTasks.length] = this;
    }
};

},{"./raw":3}],3:[function(require,module,exports){
(function (global){
"use strict";

// Use the fastest means possible to execute a task in its own turn, with
// priority over other events including IO, animation, reflow, and redraw
// events in browsers.
//
// An exception thrown by a task will permanently interrupt the processing of
// subsequent tasks. The higher level `asap` function ensures that if an
// exception is thrown by a task, that the task queue will continue flushing as
// soon as possible, but if you use `rawAsap` directly, you are responsible to
// either ensure that no exceptions are thrown from your task, or to manually
// call `rawAsap.requestFlush` if an exception is thrown.
module.exports = rawAsap;
function rawAsap(task) {
    if (!queue.length) {
        requestFlush();
        flushing = true;
    }
    // Equivalent to push, but avoids a function call.
    queue[queue.length] = task;
}

var queue = [];
// Once a flush has been requested, no further calls to `requestFlush` are
// necessary until the next `flush` completes.
var flushing = false;
// `requestFlush` is an implementation-specific method that attempts to kick
// off a `flush` event as quickly as possible. `flush` will attempt to exhaust
// the event queue before yielding to the browser's own event loop.
var requestFlush;
// The position of the next task to execute in the task queue. This is
// preserved between calls to `flush` so that it can be resumed if
// a task throws an exception.
var index = 0;
// If a task schedules additional tasks recursively, the task queue can grow
// unbounded. To prevent memory exhaustion, the task queue will periodically
// truncate already-completed tasks.
var capacity = 1024;

// The flush function processes all tasks that have been scheduled with
// `rawAsap` unless and until one of those tasks throws an exception.
// If a task throws an exception, `flush` ensures that its state will remain
// consistent and will resume where it left off when called again.
// However, `flush` does not make any arrangements to be called again if an
// exception is thrown.
function flush() {
    while (index < queue.length) {
        var currentIndex = index;
        // Advance the index before calling the task. This ensures that we will
        // begin flushing on the next task the task throws an error.
        index = index + 1;
        queue[currentIndex].call();
        // Prevent leaking memory for long chains of recursive calls to `asap`.
        // If we call `asap` within tasks scheduled by `asap`, the queue will
        // grow, but to avoid an O(n) walk for every task we execute, we don't
        // shift tasks off the queue after they have been executed.
        // Instead, we periodically shift 1024 tasks off the queue.
        if (index > capacity) {
            // Manually shift all values starting at the index back to the
            // beginning of the queue.
            for (var scan = 0, newLength = queue.length - index; scan < newLength; scan++) {
                queue[scan] = queue[scan + index];
            }
            queue.length -= index;
            index = 0;
        }
    }
    queue.length = 0;
    index = 0;
    flushing = false;
}

// `requestFlush` is implemented using a strategy based on data collected from
// every available SauceLabs Selenium web driver worker at time of writing.
// https://docs.google.com/spreadsheets/d/1mG-5UYGup5qxGdEMWkhP6BWCz053NUb2E1QoUTU16uA/edit#gid=783724593

// Safari 6 and 6.1 for desktop, iPad, and iPhone are the only browsers that
// have WebKitMutationObserver but not un-prefixed MutationObserver.
// Must use `global` or `self` instead of `window` to work in both frames and web
// workers. `global` is a provision of Browserify, Mr, Mrs, or Mop.

/* globals self */
var scope = typeof global !== "undefined" ? global : self;
var BrowserMutationObserver = scope.MutationObserver || scope.WebKitMutationObserver;

// MutationObservers are desirable because they have high priority and work
// reliably everywhere they are implemented.
// They are implemented in all modern browsers.
//
// - Android 4-4.3
// - Chrome 26-34
// - Firefox 14-29
// - Internet Explorer 11
// - iPad Safari 6-7.1
// - iPhone Safari 7-7.1
// - Safari 6-7
if (typeof BrowserMutationObserver === "function") {
    requestFlush = makeRequestCallFromMutationObserver(flush);

// MessageChannels are desirable because they give direct access to the HTML
// task queue, are implemented in Internet Explorer 10, Safari 5.0-1, and Opera
// 11-12, and in web workers in many engines.
// Although message channels yield to any queued rendering and IO tasks, they
// would be better than imposing the 4ms delay of timers.
// However, they do not work reliably in Internet Explorer or Safari.

// Internet Explorer 10 is the only browser that has setImmediate but does
// not have MutationObservers.
// Although setImmediate yields to the browser's renderer, it would be
// preferrable to falling back to setTimeout since it does not have
// the minimum 4ms penalty.
// Unfortunately there appears to be a bug in Internet Explorer 10 Mobile (and
// Desktop to a lesser extent) that renders both setImmediate and
// MessageChannel useless for the purposes of ASAP.
// https://github.com/kriskowal/q/issues/396

// Timers are implemented universally.
// We fall back to timers in workers in most engines, and in foreground
// contexts in the following browsers.
// However, note that even this simple case requires nuances to operate in a
// broad spectrum of browsers.
//
// - Firefox 3-13
// - Internet Explorer 6-9
// - iPad Safari 4.3
// - Lynx 2.8.7
} else {
    requestFlush = makeRequestCallFromTimer(flush);
}

// `requestFlush` requests that the high priority event queue be flushed as
// soon as possible.
// This is useful to prevent an error thrown in a task from stalling the event
// queue if the exception handled by Node.js’s
// `process.on("uncaughtException")` or by a domain.
rawAsap.requestFlush = requestFlush;

// To request a high priority event, we induce a mutation observer by toggling
// the text of a text node between "1" and "-1".
function makeRequestCallFromMutationObserver(callback) {
    var toggle = 1;
    var observer = new BrowserMutationObserver(callback);
    var node = document.createTextNode("");
    observer.observe(node, {characterData: true});
    return function requestCall() {
        toggle = -toggle;
        node.data = toggle;
    };
}

// The message channel technique was discovered by Malte Ubl and was the
// original foundation for this library.
// http://www.nonblocking.io/2011/06/windownexttick.html

// Safari 6.0.5 (at least) intermittently fails to create message ports on a
// page's first load. Thankfully, this version of Safari supports
// MutationObservers, so we don't need to fall back in that case.

// function makeRequestCallFromMessageChannel(callback) {
//     var channel = new MessageChannel();
//     channel.port1.onmessage = callback;
//     return function requestCall() {
//         channel.port2.postMessage(0);
//     };
// }

// For reasons explained above, we are also unable to use `setImmediate`
// under any circumstances.
// Even if we were, there is another bug in Internet Explorer 10.
// It is not sufficient to assign `setImmediate` to `requestFlush` because
// `setImmediate` must be called *by name* and therefore must be wrapped in a
// closure.
// Never forget.

// function makeRequestCallFromSetImmediate(callback) {
//     return function requestCall() {
//         setImmediate(callback);
//     };
// }

// Safari 6.0 has a problem where timers will get lost while the user is
// scrolling. This problem does not impact ASAP because Safari 6.0 supports
// mutation observers, so that implementation is used instead.
// However, if we ever elect to use timers in Safari, the prevalent work-around
// is to add a scroll event listener that calls for a flush.

// `setTimeout` does not call the passed callback if the delay is less than
// approximately 7 in web workers in Firefox 8 through 18, and sometimes not
// even then.

function makeRequestCallFromTimer(callback) {
    return function requestCall() {
        // We dispatch a timeout with a specified delay of 0 for engines that
        // can reliably accommodate that request. This will usually be snapped
        // to a 4 milisecond delay, but once we're flushing, there's no delay
        // between events.
        var timeoutHandle = setTimeout(handleTimer, 0);
        // However, since this timer gets frequently dropped in Firefox
        // workers, we enlist an interval handle that will try to fire
        // an event 20 times per second until it succeeds.
        var intervalHandle = setInterval(handleTimer, 50);

        function handleTimer() {
            // Whichever timer succeeds will cancel both timers and
            // execute the callback.
            clearTimeout(timeoutHandle);
            clearInterval(intervalHandle);
            callback();
        }
    };
}

// This is for `asap.js` only.
// Its name will be periodically randomized to break any code that depends on
// its existence.
rawAsap.makeRequestCallFromTimer = makeRequestCallFromTimer;

// ASAP was originally a nextTick shim included in Q. This was factored out
// into this ASAP package. It was later adapted to RSVP which made further
// amendments. These decisions, particularly to marginalize MessageChannel and
// to capture the MutationObserver implementation in a closure, were integrated
// back into ASAP proper.
// https://github.com/tildeio/rsvp.js/blob/cddf7232546a9cf858524b75cde6f9edf72620a7/lib/rsvp/asap.js

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],4:[function(require,module,exports){
module.exports = function _atob(str) {
  return atob(str)
}

},{}],5:[function(require,module,exports){
/**
 * AudioBuffer class
 *
 * @module audio-buffer/buffer
 *
 */
'use strict'

var isAudioBuffer = require('is-audio-buffer')
var inherit = require('inherits')
var util = require('audio-buffer-utils')
var AudioBuffer = require('audio-buffer')
var extend = require('object-assign')
var nidx = require('negative-index')
var isPlainObj = require('is-plain-obj')
var Emitter = require('events')

module.exports = AudioBufferList


inherit(AudioBufferList, Emitter)


function AudioBufferList(arg, options) {
  if (!(this instanceof AudioBufferList)) return new AudioBufferList(arg, options)

  if (typeof options === 'number') {
    options = {channels: options}
  }
  if (options && options.channels != null) options.numberOfChannels = options.channels

  extend(this, options)

  this.buffers = []
  this.length = 0
  this.duration = 0

  this.append(arg)
}


//AudioBuffer interface
AudioBufferList.prototype.numberOfChannels = 2
AudioBufferList.prototype.sampleRate = null

//copy from channel into destination array
AudioBufferList.prototype.copyFromChannel = function (destination, channel, startInChannel) {
  if (startInChannel == null) startInChannel = 0
  var offsets = this.offset(startInChannel)
  var offset = startInChannel - offsets[1]
  var initialOffset = offsets[1]
  for (var i = offsets[0], l = this.buffers.length; i < l; i++) {
    var buf = this.buffers[i]
    var data = buf.getChannelData(channel)
    if (startInChannel > offset) data = data.subarray(startInChannel)
    if (channel < buf.numberOfChannels) {
      destination.set(data, Math.max(0, offset - initialOffset))
    }
    offset += buf.length
  }
}

//put data from array to channel
AudioBufferList.prototype.copyToChannel = function (source, channel, startInChannel) {
  if (startInChannel == null) startInChannel = 0
  var offsets = this.offset(startInChannel)
  var offset = startInChannel - offsets[1]
  for (var i = offsets[0], l = this.buffers.length; i < l; i++) {
    var buf = this.buffers[i]
    var data = buf.getChannelData(channel)
    if (channel < buf.numberOfChannels) {
      data.set(source.subarray(Math.max(offset, startInChannel), offset + data.length), Math.max(0, startInChannel - offset));
    }
    offset += buf.length
  }
}

//return float array with channel data
AudioBufferList.prototype.getChannelData = function (channel, from, to) {
  if (from == null) from = 0
  if (to == null) to = this.length
  from = nidx(from, this.length)
  to = nidx(to, this.length)

  if (!this.buffers.length || from === to) return new Float32Array()

  //shortcut single buffer preserving subarraying
  if (this.buffers.length === 1) {
    return this.buffers[0].getChannelData(channel).subarray(from, to)
  }

  var floatArray = this.buffers[0].getChannelData(0).constructor
  var data = new floatArray(to - from)
  var fromOffset = this.offset(from)
  var toOffset = this.offset(to)

  var firstBuf = this.buffers[fromOffset[0]]
  data.set(firstBuf.getChannelData(channel).subarray(fromOffset[1]))

  var offset = -fromOffset[1] + firstBuf.length
  for (var i = fromOffset[0] + 1, l = toOffset[0]; i < l; i++) {
    var buf = this.buffers[i]
    data.set(buf.getChannelData(channel), offset);
    offset += buf.length
  }
  var lastBuf = this.buffers[toOffset[0]]
  data.set(lastBuf.getChannelData(channel).subarray(0, toOffset[1]), offset)

  return data
}


//patch BufferList methods
AudioBufferList.prototype.append = function (buf) {
	//FIXME: we may want to do resampling/channel mapping here or something
	var i = 0

  // unwrap argument into individual BufferLists
  if (buf instanceof AudioBufferList) {
    this.append(buf.buffers)
  }
  else if (isAudioBuffer(buf) && buf.length) {
    this._appendBuffer(buf)
  }
  else if (Array.isArray(buf)) {
    for (var l = buf.length; i < l; i++) {
      this.append(buf[i])
    }
  }
  //create AudioBuffer from (possibly num) arg
  else if (buf) {
		buf = new AudioBuffer(this.numberOfChannels || 2, buf)
		this._appendBuffer(buf)
	}

	return this
}


AudioBufferList.prototype.offset = function _offset (offset) {
  var tot = 0, i = 0, _t
  if (offset === 0) return [ 0, 0 ]
  for (; i < this.buffers.length; i++) {
    _t = tot + this.buffers[i].length
    if (offset < _t || i == this.buffers.length - 1)
      return [ i, offset - tot ]
    tot = _t
  }
}


AudioBufferList.prototype._appendBuffer = function (buf) {
  if (!buf) return this

  //update channels count
  if (!this.buffers.length) {
    this.numberOfChannels = buf.numberOfChannels
  }
  else {
    this.numberOfChannels = Math.max(this.numberOfChannels, buf.numberOfChannels)
  }
  this.duration += buf.duration

  //init sampleRate
  if (!this.sampleRate) this.sampleRate = buf.sampleRate

  //push buffer
  this.buffers.push(buf)
  this.length += buf.length

  return this
}

//copy data to destination audio buffer
AudioBufferList.prototype.copy = function copy (dst, dstStart, srcStart, srcEnd) {
	if (typeof srcStart != 'number' || srcStart < 0)
		srcStart = 0
	if (typeof srcEnd != 'number' || srcEnd > this.length)
		srcEnd = this.length
	if (srcStart >= this.length)
		return dst || new AudioBuffer(this.numberOfChannels, 0)
	if (srcEnd <= 0)
		return dst || new AudioBuffer(this.numberOfChannels, 0)

  var copy   = !!dst
    , off    = this.offset(srcStart)
    , len    = srcEnd - srcStart
    , bytes  = len
    , bufoff = (copy && dstStart) || 0
    , start  = off[1]
    , l
    , i

  // copy/slice everything
  if (srcStart === 0 && srcEnd == this.length) {
    if (!copy) { // slice, but full concat if multiple buffers
      return this.buffers.length === 1
        ? util.slice(this.buffers[0])
        : util.concat(this.buffers)
    }
    // copy, need to copy individual buffers
    for (i = 0; i < this.buffers.length; i++) {
      util.copy(this.buffers[i], dst, bufoff)
      bufoff += this.buffers[i].length
    }

    return dst
  }

  // easy, cheap case where it's a subset of one of the buffers
  if (bytes <= this.buffers[off[0]].length - start) {
    return copy
      ? util.copy(util.subbuffer(this.buffers[off[0]], start, start + bytes), dst, dstStart)
      : util.slice(this.buffers[off[0]], start, start + bytes)
  }

  if (!copy) // a slice, we need something to copy in to
    dst = new AudioBuffer(this.numberOfChannels, len)

  for (i = off[0]; i < this.buffers.length; i++) {
    l = this.buffers[i].length - start

    if (bytes > l) {
      util.copy(util.subbuffer(this.buffers[i], start), dst, bufoff)
    } else {
      util.copy(util.subbuffer(this.buffers[i], start, start + bytes), dst, bufoff)
      break
    }

    bufoff += l
    bytes -= l

    if (start)
      start = 0
  }

  return dst
}

//do superficial handle
AudioBufferList.prototype.slice = function slice (start, end) {
  start = start || 0
  end = end == null ? this.length : end

  start = nidx(start, this.length)
  end = nidx(end, this.length)

  if (start == end) {
    return new AudioBufferList(0, this.numberOfChannels)
  }

  var startOffset = this.offset(start)
    , endOffset = this.offset(end)
    , buffers = this.buffers.slice(startOffset[0], endOffset[0] + 1)

  if (endOffset[1] == 0) {
    buffers.pop()
  }
  else {
    buffers[buffers.length-1] = util.subbuffer(buffers[buffers.length-1], 0, endOffset[1])
  }

  if (startOffset[1] != 0) {
    buffers[0] = util.subbuffer(buffers[0], startOffset[1])
  }

  return new AudioBufferList(buffers, this.numberOfChannels)
}

//clone with preserving data
AudioBufferList.prototype.clone = function clone (start, end) {
  var i = 0, copy = new AudioBufferList(0, this.numberOfChannels), sublist = this.slice(start, end)

  for (; i < sublist.buffers.length; i++)
    copy.append(util.clone(sublist.buffers[i]))

  return copy
}

//clean up
AudioBufferList.prototype.destroy = function destroy () {
  this.buffers.length = 0
  this.length = 0
}


//repeat contents N times
AudioBufferList.prototype.repeat = function (times) {
  times = Math.floor(times)
  if (!times && times !== 0 || !Number.isFinite(times)) throw RangeError('Repeat count must be non-negative number.')

  if (!times) {
    this.consume(this.length)
    return this
  }

  if (times === 1) return this

  var data = this

  for (var i = 1; i < times; i++) {
    data = new AudioBufferList(data.copy())
    this.append(data)
  }

  return this
}

//insert new buffer/buffers at the offset
AudioBufferList.prototype.insert = function (offset, source) {
  if (source == null) {
    source = offset
    offset = 0
  }

  offset = nidx(offset, this.length)

  this.split(offset)

  var offset = this.offset(offset)

  //convert any type of source to audio buffer list
  source = new AudioBufferList(source)
  this.buffers.splice.apply(this.buffers, [offset[0], 0].concat(source.buffers))

  //update params
  this.length += source.length
  this.duration += source.duration
  this.numberOfChannels = Math.max(source.numberOfChannels, this.numberOfChannels)

  return this
}

//delete N samples from any position
AudioBufferList.prototype.remove = function (offset, count) {
  if (count == null) {
    count = offset
    offset = 0
  }
  if (!count) return this

  if (count < 0) {
    count = -count
    offset -= count
  }

  offset = nidx(offset, this.length)
  count = Math.min(this.length - offset, count)

  this.split(offset, offset + count)

  var offsetLeft = this.offset(offset)
  var offsetRight = this.offset(offset + count)

  if (offsetRight[1] === this.buffers[offsetRight[0]].length) {
    offsetRight[0] += 1
  }

  let deleted = this.buffers.splice(offsetLeft[0], offsetRight[0] - offsetLeft[0])
  deleted = new AudioBufferList(deleted, this.numberOfChannels)

  this.length -= deleted.length
  this.duration = this.length / this.sampleRate

  return deleted
}

//delete samples from the list, return self
AudioBufferList.prototype.delete = function () {
  this.remove.apply(this, arguments)
  return this
}

//remove N sampled from the beginning
AudioBufferList.prototype.consume = function consume (size) {
  while (this.buffers.length) {
    if (size >= this.buffers[0].length) {
      size -= this.buffers[0].length
      this.length -= this.buffers[0].length
      this.buffers.shift()
    } else {
      //util.subbuffer would remain buffer in memory though it is faster
      this.buffers[0] = util.subbuffer(this.buffers[0], size)
      this.length -= size
      break
    }
  }
  this.duration = this.length / this.sampleRate
  return this
}


//return new list via applying fn to each buffer from the indicated range
AudioBufferList.prototype.map = function map (fn, from, to) {
  if (from == null) from = 0
  if (to == null) to = this.length
  from = nidx(from, this.length)
  to = nidx(to, this.length)

  let fromOffset = this.offset(from)
  let toOffset = this.offset(to)

  let offset = from - fromOffset[1]
  let before = this.buffers.slice(0, fromOffset[0])
  let after = this.buffers.slice(toOffset[0] + 1)
  let middle = this.buffers.slice(fromOffset[0], toOffset[0] + 1)

  middle = middle.map((buf, idx) => {
    let result = fn.call(this, buf, idx, offset, this.buffers, this)
    if (result === undefined || result === true) result = buf
    //ignore removed buffers
    if (!result) {
      return null;
    }

    //track offset
    offset += result.length

    return result
  })
  .filter((buf) => {
    return buf ? !!buf.length : false
  })

  return new AudioBufferList(before.concat(middle).concat(after), this.numberOfChannels)
}

//apply fn to every buffer for the indicated range
AudioBufferList.prototype.each = function each (fn, from, to, reversed) {
  let options = arguments[arguments.length - 1]
  if (!isPlainObj(options)) options = {reversed: false}

  if (typeof from != 'number') from = 0
  if (typeof to != 'number') to = this.length
  from = nidx(from, this.length)
  to = nidx(to, this.length)

  let fromOffset = this.offset(from)
  let toOffset = this.offset(to)

  let middle = this.buffers.slice(fromOffset[0], toOffset[0] + 1)

  if (options.reversed) {
    let offset = to - toOffset[1]
    for (let i = toOffset[0], l = fromOffset[0]; i >= l; i--) {
      let buf = this.buffers[i]
      let res = fn.call(this, buf, i, offset, this.buffers, this)
      if (res === false) break
      offset -= buf.length
    }
  }
  else {
    let offset = from - fromOffset[1]
    for (let i = fromOffset[0], l = toOffset[0]+1; i < l; i++) {
      let buf = this.buffers[i]
      let res = fn.call(this, buf, i, offset, this.buffers, this)
      if (res === false) break
      offset += buf.length
    }
  }

  return this;
}

//reverse subpart
AudioBufferList.prototype.reverse = function reverse (from, to) {
  if (from == null) from = 0
  if (to == null) to = this.length

  from = nidx(from, this.length)
  to = nidx(to, this.length)

  let sublist = this.slice(from, to)
  .each((buf) => {
    util.reverse(buf)
  })
  sublist.buffers.reverse()

  this.remove(from, to-from)

  this.insert(from, sublist)

  return this
}

//split at the indicated indexes
AudioBufferList.prototype.split = function split () {
  let args = arguments;

  for (let i = 0; i < args.length; i++ ) {
    let arg = args[i]
    if (Array.isArray(arg)) {
      this.split.apply(this, arg)
    }
    else if (typeof arg === 'number') {
      let offset = this.offset(arg)
      let buf = this.buffers[offset[0]]

      if (offset[1] > 0 && offset[1] < buf.length) {
        let left = util.subbuffer(buf, 0, offset[1])
        let right = util.subbuffer(buf, offset[1])

        this.buffers.splice(offset[0], 1, left, right)
      }
    }
  }

  return this
}


//join buffers within the subrange
AudioBufferList.prototype.join = function join (from, to) {
  if (from == null) from = 0
  if (to == null) to = this.length

  from = nidx(from, this.length)
  to = nidx(to, this.length)

  let fromOffset = this.offset(from)
  let toOffset = this.offset(to)

  let bufs = this.buffers.slice(fromOffset[0], toOffset[0])
  let buf = util.concat(bufs)

  this.buffers.splice.apply(this.buffers, [fromOffset[0], toOffset[0] - fromOffset[0] + (toOffset[1] ? 1 : 0)].concat(buf))

  return this
}

},{"audio-buffer":6,"audio-buffer-utils":7,"events":199,"inherits":17,"is-audio-buffer":18,"is-plain-obj":22,"negative-index":24,"object-assign":26}],6:[function(require,module,exports){
/**
 * AudioBuffer class
 *
 * @module audio-buffer/buffer
 */
'use strict'

var isBuffer = require('is-buffer')
var b2ab = require('buffer-to-arraybuffer')
var isBrowser = require('is-browser')
var isAudioBuffer = require('is-audio-buffer')
var context = require('audio-context')
var isPlainObj = require('is-plain-obj')


module.exports = AudioBuffer


/**
 * @constructor
 *
 * @param {∀} data Any collection-like object
 */
function AudioBuffer (channels, data, sampleRate, options) {
	//enforce class
	if (!(this instanceof AudioBuffer)) return new AudioBuffer(channels, data, sampleRate, options);

	//detect last argument
	var c = arguments.length
	while (!arguments[c] && c) c--;
	var lastArg = arguments[c];

	//figure out options
	var ctx, isWAA, floatArray, isForcedType = false
	if (lastArg && typeof lastArg != 'number') {
		ctx = lastArg.context || (context && context())
		isWAA = lastArg.isWAA != null ? lastArg.isWAA : !!(isBrowser && ctx.createBuffer)
		floatArray = lastArg.floatArray || Float32Array
		if (lastArg.floatArray) isForcedType = true
	}
	else {
		ctx = context && context()
		isWAA = !!ctx
		floatArray = Float32Array
	}

	//if one argument only - it is surely data or length
	//having new AudioBuffer(2) does not make sense as 2 being number of channels
	if (data == null || isPlainObj(data)) {
		data = channels || 1;
		channels = null;
	}
	//audioCtx.createBuffer() - complacent arguments
	else {
		if (typeof sampleRate == 'number') this.sampleRate = sampleRate;
		else if (isBrowser) this.sampleRate = ctx.sampleRate;
		if (channels != null) this.numberOfChannels = channels;
	}

	//if AudioBuffer(channels?, number, rate?) = create new array
	//this is the default WAA-compatible case
	if (typeof data === 'number') {
		this.length = data;
		this.data = []
		for (var c = 0; c < this.numberOfChannels; c++) {
			this.data[c] = new floatArray(data)
		}
	}
	//if other audio buffer passed - create fast clone of it
	//if WAA AudioBuffer - get buffer’s data (it is bounded)
	else if (isAudioBuffer(data)) {
		this.length = data.length;
		if (channels == null) this.numberOfChannels = data.numberOfChannels;
		if (sampleRate == null) this.sampleRate = data.sampleRate;

		this.data = []

		//copy channel's data
		for (var c = 0, l = this.numberOfChannels; c < l; c++) {
			this.data[c] = data.getChannelData(c).slice()
		}
	}
	//TypedArray, Buffer, DataView etc, or ArrayBuffer
	//NOTE: node 4.x+ detects Buffer as ArrayBuffer view
	else if (ArrayBuffer.isView(data) || data instanceof ArrayBuffer || isBuffer(data)) {
		if (isBuffer(data)) {
			data = b2ab(data);
		}
		//convert non-float array to floatArray
		if (!(data instanceof Float32Array) && !(data instanceof Float64Array)) {
			data = new floatArray(data.buffer || data);
		}

		this.length = Math.floor(data.length / this.numberOfChannels);
		this.data = []
		for (var c = 0; c < this.numberOfChannels; c++) {
			this.data[c] = data.subarray(c * this.length, (c + 1) * this.length);
		}
	}
	//if array - parse channeled data
	else if (Array.isArray(data)) {
		//if separated data passed already - send sub-arrays to channels
		if (data[0] instanceof Object) {
			if (channels == null) this.numberOfChannels = data.length;
			this.length = data[0].length;
			this.data = []
			for (var c = 0; c < this.numberOfChannels; c++ ) {
				this.data[c] = (!isForcedType && ((data[c] instanceof Float32Array) || (data[c] instanceof Float64Array))) ? data[c] : new floatArray(data[c])
			}
		}
		//plain array passed - split array equipartially
		else {
			this.length = Math.floor(data.length / this.numberOfChannels);
			this.data = []
			for (var c = 0; c < this.numberOfChannels; c++) {
				this.data[c] = new floatArray(data.slice(c * this.length, (c + 1) * this.length))
			}
		}
	}
	//if ndarray, typedarray or other data-holder passed - redirect plain databuffer
	else if (data && (data.data || data.buffer)) {
		return new AudioBuffer(this.numberOfChannels, data.data || data.buffer, this.sampleRate);
	}
	//if other - unable to parse arguments
	else {
		throw Error('Failed to create buffer: check provided arguments');
	}


	//for browser - return WAA buffer, no sub-buffering allowed
	if (isWAA) {
		//create WAA buffer
		var audioBuffer = ctx.createBuffer(this.numberOfChannels, this.length, this.sampleRate);

		//fill channels
		for (var c = 0; c < this.numberOfChannels; c++) {
			audioBuffer.getChannelData(c).set(this.getChannelData(c));
		}

		return audioBuffer;
	}

	this.duration = this.length / this.sampleRate;
}


/**
 * Default params
 */
AudioBuffer.prototype.numberOfChannels = 2;
AudioBuffer.prototype.sampleRate = context.sampleRate || 44100;


/**
 * Return data associated with the channel.
 *
 * @return {Array} Array containing the data
 */
AudioBuffer.prototype.getChannelData = function (channel) {
	//FIXME: ponder on this, whether we really need that rigorous check, it may affect performance
	if (channel >= this.numberOfChannels || channel < 0 || channel == null) throw Error('Cannot getChannelData: channel number (' + channel + ') exceeds number of channels (' + this.numberOfChannels + ')');

	return this.data[channel]
};


/**
 * Place data to the destination buffer, starting from the position
 */
AudioBuffer.prototype.copyFromChannel = function (destination, channelNumber, startInChannel) {
	if (startInChannel == null) startInChannel = 0;
	var data = this.data[channelNumber]
	for (var i = startInChannel, j = 0; i < this.length && j < destination.length; i++, j++) {
		destination[j] = data[i];
	}
}


/**
 * Place data from the source to the channel, starting (in self) from the position
 * Clone of WAAudioBuffer
 */
AudioBuffer.prototype.copyToChannel = function (source, channelNumber, startInChannel) {
	var data = this.data[channelNumber]

	if (!startInChannel) startInChannel = 0;

	for (var i = startInChannel, j = 0; i < this.length && j < source.length; i++, j++) {
		data[i] = source[j];
	}
};


},{"audio-context":10,"buffer-to-arraybuffer":11,"is-audio-buffer":18,"is-browser":19,"is-buffer":20,"is-plain-obj":22}],7:[function(require,module,exports){
/**
 * @module  audio-buffer-utils
 */

'use strict'

require('typedarray-methods')
var AudioBuffer = require('audio-buffer')
var isAudioBuffer = require('is-audio-buffer')
var isBrowser = require('is-browser')
var nidx = require('negative-index')
var clamp = require('clamp')
var context = require('audio-context')

module.exports = {
	create: create,
	copy: copy,
	shallow: shallow,
	clone: clone,
	reverse: reverse,
	invert: invert,
	zero: zero,
	noise: noise,
	equal: equal,
	fill: fill,
	slice: slice,
	concat: concat,
	resize: resize,
	pad: pad,
	padLeft: padLeft,
	padRight: padRight,
	rotate: rotate,
	shift: shift,
	normalize: normalize,
	removeStatic: removeStatic,
	trim: trim,
	trimLeft: trimLeft,
	trimRight: trimRight,
	mix: mix,
	size: size,
	data: data,
	subbuffer: subbuffer
}


/**
 * Create buffer from any argument
 */
function create (len, channels, rate, options) {
	if (!options) options = {}
	return new AudioBuffer(channels, len, rate, options);
}


/**
 * Copy data from buffer A to buffer B
 */
function copy (from, to, offset) {
	validate(from);
	validate(to);

	offset = offset || 0;

	for (var channel = 0, l = Math.min(from.numberOfChannels, to.numberOfChannels); channel < l; channel++) {
		to.getChannelData(channel).set(from.getChannelData(channel), offset);
	}

	return to;
}


/**
 * Assert argument is AudioBuffer, throw error otherwise.
 */
function validate (buffer) {
	if (!isAudioBuffer(buffer)) throw new Error('Argument should be an AudioBuffer instance.');
}



/**
 * Create a buffer with the same characteristics as inBuffer, without copying
 * the data. Contents of resulting buffer are undefined.
 */
function shallow (buffer) {
	validate(buffer);

	//workaround for faster browser creation
	//avoid extra checks & copying inside of AudioBuffer class
	if (isBrowser) {
		return context().createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
	}

	return create(buffer.length, buffer.numberOfChannels, buffer.sampleRate);
}


/**
 * Create clone of a buffer
 */
function clone (buffer) {
	return copy(buffer, shallow(buffer));
}


/**
 * Reverse samples in each channel
 */
function reverse (buffer, target, start, end) {
	validate(buffer);

	//if target buffer is passed
	if (!isAudioBuffer(target) && target != null) {
		end = start;
		start = target;
		target = null;
	}

	if (target) {
		validate(target);
		copy(buffer, target);
	}
	else {
		target = buffer;
	}

	start = start == null ? 0 : nidx(start, buffer.length);
	end = end == null ? buffer.length : nidx(end, buffer.length);

	for (var i = 0, c = target.numberOfChannels; i < c; ++i) {
		target.getChannelData(i).subarray(start, end).reverse();
	}

	return target;
}


/**
 * Invert amplitude of samples in each channel
 */
function invert (buffer, target, start, end) {
	//if target buffer is passed
	if (!isAudioBuffer(target) && target != null) {
		end = start;
		start = target;
		target = null;
	}

	return fill(buffer, target, function (sample) { return -sample; }, start, end);
}


/**
 * Fill with zeros
 */
function zero (buffer, target, start, end) {
	return fill(buffer, target, 0, start, end);
}


/**
 * Fill with white noise
 */
function noise (buffer, target, start, end) {
	return fill(buffer, target, function (sample) { return Math.random() * 2 - 1; }, start, end);
}


/**
 * Test whether two buffers are the same
 */
function equal (bufferA, bufferB) {
	//walk by all the arguments
	if (arguments.length > 2) {
		for (var i = 0, l = arguments.length - 1; i < l; i++) {
			if (!equal(arguments[i], arguments[i + 1])) return false;
		}
		return true;
	}

	validate(bufferA);
	validate(bufferB);

	if (bufferA.length !== bufferB.length || bufferA.numberOfChannels !== bufferB.numberOfChannels) return false;

	for (var channel = 0; channel < bufferA.numberOfChannels; channel++) {
		var dataA = bufferA.getChannelData(channel);
		var dataB = bufferB.getChannelData(channel);

		for (var i = 0; i < dataA.length; i++) {
			if (dataA[i] !== dataB[i]) return false;
		}
	}

	return true;
}



/**
 * Generic in-place fill/transform
 */
function fill (buffer, target, value, start, end) {
	validate(buffer);

	//if target buffer is passed
	if (!isAudioBuffer(target) && target != null) {
		//target is bad argument
		if (typeof value == 'function') {
			target = null;
		}
		else {
			end = start;
			start = value;
			value = target;
			target = null;
		}
	}

	if (target) {
		validate(target);
	}
	else {
		target = buffer;
	}

	//resolve optional start/end args
	start = start == null ? 0 : nidx(start, buffer.length);
	end = end == null ? buffer.length : nidx(end, buffer.length);
	//resolve type of value
	if (!(value instanceof Function)) {
		for (var channel = 0, c = buffer.numberOfChannels; channel < c; channel++) {
			var targetData = target.getChannelData(channel);
			for (var i = start; i < end; i++) {
				targetData[i] = value
			}
		}
	}
	else {
		for (var channel = 0, c = buffer.numberOfChannels; channel < c; channel++) {
			var data = buffer.getChannelData(channel),
				targetData = target.getChannelData(channel);
			for (var i = start; i < end; i++) {
				targetData[i] = value.call(buffer, data[i], i, channel, data);
			}
		}
	}

	return target;
}


/**
 * Return sliced buffer
 */
function slice (buffer, start, end) {
	validate(buffer);

	start = start == null ? 0 : nidx(start, buffer.length);
	end = end == null ? buffer.length : nidx(end, buffer.length);

	var data = [];
	for (var channel = 0; channel < buffer.numberOfChannels; channel++) {
		var channelData = buffer.getChannelData(channel)
		data.push(channelData.slice(start, end));
	}
	return create(data, buffer.numberOfChannels, buffer.sampleRate);
}

/**
 * Create handle for a buffer from subarrays
 */
function subbuffer (buffer, start, end) {
	validate(buffer);

	start = start == null ? 0 : nidx(start, buffer.length);
	end = end == null ? buffer.length : nidx(end, buffer.length);

	var data = [];
	for (var channel = 0; channel < buffer.numberOfChannels; channel++) {
		var channelData = buffer.getChannelData(channel)
		data.push(channelData.subarray(start, end));
	}
	return create(data, buffer.numberOfChannels, buffer.sampleRate, {isWAA: false});
}

/**
 * Concat buffer with other buffer(s)
 */
function concat () {
	var list = []

	for (var i = 0, l = arguments.length; i < l; i++) {
		var arg = arguments[i]
		if (Array.isArray(arg)) {
			for (var j = 0; j < arg.length; j++) {
				list.push(arg[j])
			}
		}
		else {
			list.push(arg)
		}
	}

	var channels = 1;
	var length = 0;
	//FIXME: there might be required more thoughtful resampling, but now I'm lazy sry :(
	var sampleRate = 0;

	for (var i = 0; i < list.length; i++) {
		var buf = list[i]
		validate(buf)
		length += buf.length
		channels = Math.max(buf.numberOfChannels, channels)
		sampleRate = Math.max(buf.sampleRate, sampleRate)
	}

	var data = [];
	for (var channel = 0; channel < channels; channel++) {
		var channelData = new Float32Array(length), offset = 0

		for (var i = 0; i < list.length; i++) {
			var buf = list[i]
			if (channel < buf.numberOfChannels) {
				channelData.set(buf.getChannelData(channel), offset);
			}
			offset += buf.length
		}

		data.push(channelData);
	}

	return create(data, channels, sampleRate);
}


/**
 * Change the length of the buffer, by trimming or filling with zeros
 */
function resize (buffer, length) {
	validate(buffer);

	if (length < buffer.length) return slice(buffer, 0, length);

	return concat(buffer, create(length - buffer.length, buffer.numberOfChannels));
}


/**
 * Pad buffer to required size
 */
function pad (a, b, value) {
	var buffer, length;

	if (typeof a === 'number') {
		buffer = b;
		length = a;
	} else {
		buffer = a;
		length = b;
	}

	value = value || 0;

	validate(buffer);

	//no need to pad
	if (length < buffer.length) return buffer;

	//left-pad
	if (buffer === b) {
		return concat(fill(create(length - buffer.length, buffer.numberOfChannels), value), buffer);
	}

	//right-pad
	return concat(buffer, fill(create(length - buffer.length, buffer.numberOfChannels), value));
}
function padLeft (data, len, value) {
	return pad(len, data, value)
}
function padRight (data, len, value) {
	return pad(data, len, value)
}



/**
 * Shift content of the buffer in circular fashion
 */
function rotate (buffer, offset) {
	validate(buffer);

	for (var channel = 0; channel < buffer.numberOfChannels; channel++) {
		var cData = buffer.getChannelData(channel);
		var srcData = cData.slice();
		for (var i = 0, l = cData.length, idx; i < l; i++) {
			idx = (offset + (offset + i < 0 ? l + i : i )) % l;
			cData[idx] = srcData[i];
		}
	}

	return buffer;
}


/**
 * Shift content of the buffer
 */
function shift (buffer, offset) {
	validate(buffer);

	for (var channel = 0; channel < buffer.numberOfChannels; channel++) {
		var cData = buffer.getChannelData(channel);
		if (offset > 0) {
			for (var i = cData.length - offset; i--;) {
				cData[i + offset] = cData[i];
			}
		}
		else {
			for (var i = -offset, l = cData.length - offset; i < l; i++) {
				cData[i + offset] = cData[i] || 0;
			}
		}
	}

	return buffer;
}


/**
 * Normalize buffer by the maximum value,
 * limit values by the -1..1 range
 */
function normalize (buffer, target, start, end) {
	//resolve optional target arg
	if (!isAudioBuffer(target)) {
		end = start;
		start = target;
		target = null;
	}

	start = start == null ? 0 : nidx(start, buffer.length);
	end = end == null ? buffer.length : nidx(end, buffer.length);

	//for every channel bring it to max-min amplitude range
	var max = 0

	for (var c = 0; c < buffer.numberOfChannels; c++) {
		var data = buffer.getChannelData(c)
		for (var i = start; i < end; i++) {
			max = Math.max(Math.abs(data[i]), max)
		}
	}

	var amp = Math.max(1 / max, 1)

	return fill(buffer, target, function (value, i, ch) {
		return clamp(value * amp, -1, 1)
	}, start, end);
}

/**
 * remove DC offset
 */
function removeStatic (buffer, target, start, end) {
	var means = mean(buffer, start, end)

	return fill(buffer, target, function (value, i, ch) {
		return value - means[ch];
	}, start, end);
}

/**
 * Get average level per-channel
 */
function mean (buffer, start, end) {
	validate(buffer)

	start = start == null ? 0 : nidx(start, buffer.length);
	end = end == null ? buffer.length : nidx(end, buffer.length);

	if (end - start < 1) return []

	var result = []

	for (var c = 0; c < buffer.numberOfChannels; c++) {
		var sum = 0
		var data = buffer.getChannelData(c)
		for (var i = start; i < end; i++) {
			sum += data[i]
		}
		result.push(sum / (end - start))
	}

	return result
}


/**
 * Trim sound (remove zeros from the beginning and the end)
 */
function trim (buffer, level) {
	return trimInternal(buffer, level, true, true);
}

function trimLeft (buffer, level) {
	return trimInternal(buffer, level, true, false);
}

function trimRight (buffer, level) {
	return trimInternal(buffer, level, false, true);
}

function trimInternal(buffer, level, trimLeft, trimRight) {
	validate(buffer);

	level = (level == null) ? 0 : Math.abs(level);

	var start, end;

	if (trimLeft) {
		start = buffer.length;
		//FIXME: replace with indexOF
		for (var channel = 0, c = buffer.numberOfChannels; channel < c; channel++) {
			var data = buffer.getChannelData(channel);
			for (var i = 0; i < data.length; i++) {
				if (i > start) break;
				if (Math.abs(data[i]) > level) {
					start = i;
					break;
				}
			}
		}
	} else {
		start = 0;
	}

	if (trimRight) {
		end = 0;
		//FIXME: replace with lastIndexOf
		for (var channel = 0, c = buffer.numberOfChannels; channel < c; channel++) {
			var data = buffer.getChannelData(channel);
			for (var i = data.length - 1; i >= 0; i--) {
				if (i < end) break;
				if (Math.abs(data[i]) > level) {
					end = i + 1;
					break;
				}
			}
		}
	} else {
		end = buffer.length;
	}

	return slice(buffer, start, end);
}


/**
 * Mix current buffer with the other one.
 * The reason to modify bufferA instead of returning the new buffer
 * is reduced amount of calculations and flexibility.
 * If required, the cloning can be done before mixing, which will be the same.
 */
function mix (bufferA, bufferB, ratio, offset) {
	validate(bufferA);
	validate(bufferB);

	if (ratio == null) ratio = 0.5;
	var fn = ratio instanceof Function ? ratio : function (a, b) {
		return a * (1 - ratio) + b * ratio;
	};

	if (offset == null) offset = 0;
	else if (offset < 0) offset += bufferA.length;

	for (var channel = 0; channel < bufferA.numberOfChannels; channel++) {
		var aData = bufferA.getChannelData(channel);
		var bData = bufferB.getChannelData(channel);

		for (var i = offset, j = 0; i < bufferA.length && j < bufferB.length; i++, j++) {
			aData[i] = fn.call(bufferA, aData[i], bData[j], j, channel);
		}
	}

	return bufferA;
}


/**
 * Size of a buffer, in bytes
 */
function size (buffer) {
	validate(buffer);

	return buffer.numberOfChannels * buffer.getChannelData(0).byteLength;
}


/**
 * Return array with buffer’s per-channel data
 */
function data (buffer, data) {
	validate(buffer);

	//ensure output data array, if not defined
	data = data || [];

	//transfer data per-channel
	for (var channel = 0; channel < buffer.numberOfChannels; channel++) {
		if (ArrayBuffer.isView(data[channel])) {
			data[channel].set(buffer.getChannelData(channel));
		}
		else {
			data[channel] = buffer.getChannelData(channel);
		}
	}

	return data;
}

},{"audio-buffer":8,"audio-context":10,"clamp":12,"is-audio-buffer":18,"is-browser":19,"negative-index":24,"typedarray-methods":38}],8:[function(require,module,exports){
arguments[4][6][0].apply(exports,arguments)
},{"audio-context":10,"buffer-to-arraybuffer":11,"dup":6,"is-audio-buffer":18,"is-browser":19,"is-buffer":20,"is-plain-obj":22}],9:[function(require,module,exports){
/**
 * AudioBuffer class
 *
 * @module audio-buffer/buffer
 */
'use strict'

var getContext = require('audio-context')

module.exports = AudioBuffer


/**
 * @constructor
 */
function AudioBuffer (context, options) {
	if (!(this instanceof AudioBuffer)) return new AudioBuffer(context, options);

	//if no options passed
	if (!options) {
		options = context
		context = options && options.context
	}

	if (!options) options = {}

	if (context === undefined) context = getContext()

	//detect params
	if (options.numberOfChannels == null) {
		options.numberOfChannels = 1
	}
	if (options.sampleRate == null) {
		options.sampleRate = context && context.sampleRate || this.sampleRate
	}
	if (options.length == null) {
		if (options.duration != null) {
			options.length = options.duration * options.sampleRate
		}
		else {
			options.length = 1
		}
	}

	//if existing context
	if (context && context.createBuffer) {
		//create WAA buffer
		return context.createBuffer(options.numberOfChannels, Math.ceil(options.length), options.sampleRate)
	}

	//exposed properties
	this.length = Math.ceil(options.length)
	this.numberOfChannels = options.numberOfChannels
	this.sampleRate = options.sampleRate
	this.duration = this.length / this.sampleRate

	//data is stored as a planar sequence
	this._data = new Float32Array(this.length * this.numberOfChannels)

	//channels data is cached as subarrays
	this._channelData = []
	for (var c = 0; c < this.numberOfChannels; c++) {
		this._channelData.push(this._data.subarray(c * this.length, (c+1) * this.length ))
	}
}


/**
 * Default params
 */
AudioBuffer.prototype.numberOfChannels = 1;
AudioBuffer.prototype.sampleRate = 44100;


/**
 * Return data associated with the channel.
 *
 * @return {Array} Array containing the data
 */
AudioBuffer.prototype.getChannelData = function (channel) {
	if (channel >= this.numberOfChannels || channel < 0 || channel == null) throw Error('Cannot getChannelData: channel number (' + channel + ') exceeds number of channels (' + this.numberOfChannels + ')');

	return this._channelData[channel]
};


/**
 * Place data to the destination buffer, starting from the position
 */
AudioBuffer.prototype.copyFromChannel = function (destination, channelNumber, startInChannel) {
	if (startInChannel == null) startInChannel = 0;
	var data = this._channelData[channelNumber]
	for (var i = startInChannel, j = 0; i < this.length && j < destination.length; i++, j++) {
		destination[j] = data[i];
	}
}


/**
 * Place data from the source to the channel, starting (in self) from the position
 */
AudioBuffer.prototype.copyToChannel = function (source, channelNumber, startInChannel) {
	var data = this._channelData[channelNumber]

	if (!startInChannel) startInChannel = 0;

	for (var i = startInChannel, j = 0; i < this.length && j < source.length; i++, j++) {
		data[i] = source[j];
	}
};


},{"audio-context":10}],10:[function(require,module,exports){
'use strict'

var cache = {}

module.exports = function getContext (options) {
	if (typeof window === 'undefined') return null
	
	var OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext
	var Context = window.AudioContext || window.webkitAudioContext
	
	if (!Context) return null

	if (typeof options === 'number') {
		options = {sampleRate: options}
	}

	var sampleRate = options && options.sampleRate


	if (options && options.offline) {
		if (!OfflineContext) return null

		return new OfflineContext(options.channels || 2, options.length, sampleRate || 44100)
	}


	//cache by sampleRate, rather strong guess
	var ctx = cache[sampleRate]

	if (ctx) return ctx

	//several versions of firefox have issues with the
	//constructor argument
	//see: https://bugzilla.mozilla.org/show_bug.cgi?id=1361475
	try {
		ctx = new Context(options)
	}
	catch (err) {
		ctx = new Context()
	}
	cache[ctx.sampleRate] = cache[sampleRate] = ctx

	return ctx
}

},{}],11:[function(require,module,exports){
(function (Buffer){
(function(root) {
  var isArrayBufferSupported = (new Buffer(0)).buffer instanceof ArrayBuffer;

  var bufferToArrayBuffer = isArrayBufferSupported ? bufferToArrayBufferSlice : bufferToArrayBufferCycle;

  function bufferToArrayBufferSlice(buffer) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }

  function bufferToArrayBufferCycle(buffer) {
    var ab = new ArrayBuffer(buffer.length);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
      view[i] = buffer[i];
    }
    return ab;
  }

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = bufferToArrayBuffer;
    }
    exports.bufferToArrayBuffer = bufferToArrayBuffer;
  } else if (typeof define === 'function' && define.amd) {
    define([], function() {
      return bufferToArrayBuffer;
    });
  } else {
    root.bufferToArrayBuffer = bufferToArrayBuffer;
  }
})(this);

}).call(this,require("buffer").Buffer)
},{"buffer":197}],12:[function(require,module,exports){
module.exports = clamp

function clamp(value, min, max) {
  return min < max
    ? (value < min ? min : value > max ? max : value)
    : (value < max ? max : value > min ? min : value)
}

},{}],13:[function(require,module,exports){
'use strict';

// MODULES //

var isArray = require( 'validate.io-array' ),
	isIntegerArray = require( 'validate.io-integer-array' ),
	isFunction = require( 'validate.io-function' );


// VARIABLES //

var MAXINT = Math.pow( 2, 53 ) - 1;


// FUNCTIONS //

/**
* FUNCTION: gcd( a, b )
*	Computes the greatest common divisor of two integers `a` and `b`, using the binary GCD algorithm.
*
* @param {Number} a - integer
* @param {Number} b - integer
* @returns {Number} greatest common divisor
*/
function gcd( a, b ) {
	var k = 1,
		t;
	// Simple cases:
	if ( a === 0 ) {
		return b;
	}
	if ( b === 0 ) {
		return a;
	}
	// Reduce `a` and/or `b` to odd numbers and keep track of the greatest power of 2 dividing both `a` and `b`...
	while ( a%2 === 0 && b%2 === 0 ) {
		a = a / 2; // right shift
		b = b / 2; // right shift
		k = k * 2; // left shift
	}
	// Reduce `a` to an odd number...
	while ( a%2 === 0 ) {
		a = a / 2; // right shift
	}
	// Henceforth, `a` is always odd...
	while ( b ) {
		// Remove all factors of 2 in `b`, as they are not common...
		while ( b%2 === 0 ) {
			b = b / 2; // right shift
		}
		// `a` and `b` are both odd. Swap values such that `b` is the larger of the two values, and then set `b` to the difference (which is even)...
		if ( a > b ) {
			t = b;
			b = a;
			a = t;
		}
		b = b - a; // b=0 iff b=a
	}
	// Restore common factors of 2...
	return k * a;
} // end FUNCTION gcd()

/**
* FUNCTION: bitwise( a, b )
*	Computes the greatest common divisor of two integers `a` and `b`, using the binary GCD algorithm and bitwise operations.
*
* @param {Number} a - safe integer
* @param {Number} b - safe integer
* @returns {Number} greatest common divisor
*/
function bitwise( a, b ) {
	var k = 0,
		t;
	// Simple cases:
	if ( a === 0 ) {
		return b;
	}
	if ( b === 0 ) {
		return a;
	}
	// Reduce `a` and/or `b` to odd numbers and keep track of the greatest power of 2 dividing both `a` and `b`...
	while ( (a & 1) === 0 && (b & 1) === 0 ) {
		a >>>= 1; // right shift
		b >>>= 1; // right shift
		k++;
	}
	// Reduce `a` to an odd number...
	while ( (a & 1) === 0 ) {
		a >>>= 1; // right shift
	}
	// Henceforth, `a` is always odd...
	while ( b ) {
		// Remove all factors of 2 in `b`, as they are not common...
		while ( (b & 1) === 0 ) {
			b >>>= 1; // right shift
		}
		// `a` and `b` are both odd. Swap values such that `b` is the larger of the two values, and then set `b` to the difference (which is even)...
		if ( a > b ) {
			t = b;
			b = a;
			a = t;
		}
		b = b - a; // b=0 iff b=a
	}
	// Restore common factors of 2...
	return a << k;
} // end FUNCTION bitwise()


// GREATEST COMMON DIVISOR //

/**
* FUNCTION: compute( arr[, clbk] )
*	Computes the greatest common divisor.
*
* @param {Number[]|Number} arr - input array of integers
* @param {Function|Number} [clbk] - accessor function for accessing array values
* @returns {Number|Null} greatest common divisor or null
*/
function compute() {
	var nargs = arguments.length,
		args,
		clbk,
		arr,
		len,
		a, b,
		i;

	// Copy the input arguments to an array...
	args = new Array( nargs );
	for ( i = 0; i < nargs; i++ ) {
		args[ i ] = arguments[ i ];
	}
	// Have we been provided with integer arguments?
	if ( isIntegerArray( args ) ) {
		if ( nargs === 2 ) {
			a = args[ 0 ];
			b = args[ 1 ];
			if ( a < 0 ) {
				a = -a;
			}
			if ( b < 0 ) {
				b = -b;
			}
			if ( a <= MAXINT && b <= MAXINT ) {
				return bitwise( a, b );
			} else {
				return gcd( a, b );
			}
		}
		arr = args;
	}
	// If not integers, ensure the first argument is an array...
	else if ( !isArray( args[ 0 ] ) ) {
		throw new TypeError( 'gcd()::invalid input argument. Must provide an array of integers. Value: `' + args[ 0 ] + '`.' );
	}
	// Have we been provided with more than one argument? If so, ensure that the accessor argument is a function...
	else if ( nargs > 1 ) {
		arr = args[ 0 ];
		clbk = args[ 1 ];
		if ( !isFunction( clbk ) ) {
			throw new TypeError( 'gcd()::invalid input argument. Accessor must be a function. Value: `' + clbk + '`.' );
		}
	}
	// We have been provided an array...
	else {
		arr = args[ 0 ];
	}
	len = arr.length;

	// Check if a sufficient number of values have been provided...
	if ( len < 2 ) {
		return null;
	}
	// If an accessor is provided, extract the array values...
	if ( clbk ) {
		a = new Array( len );
		for ( i = 0; i < len; i++ ) {
			a[ i ] = clbk( arr[ i ], i );
		}
		arr = a;
	}
	// Given an input array, ensure all array values are integers...
	if ( nargs < 3 ) {
		if ( !isIntegerArray( arr ) ) {
			throw new TypeError( 'gcd()::invalid input argument. Accessed array values must be integers. Value: `' + arr + '`.' );
		}
	}
	// Convert any negative integers to positive integers...
	for ( i = 0; i < len; i++ ) {
		a = arr[ i ];
		if ( a < 0 ) {
			arr[ i ] = -a;
		}
	}
	// Exploit the fact that the gcd is an associative function...
	a = arr[ 0 ];
	for ( i = 1; i < len; i++ ) {
		b = arr[ i ];
		if ( b <= MAXINT && a <= MAXINT ) {
			a = bitwise( a, b );
		} else {
			a = gcd( a, b );
		}
	}
	return a;
} // end FUNCTION compute()


// EXPORTS //

module.exports = compute;

},{"validate.io-array":39,"validate.io-function":40,"validate.io-integer-array":41}],14:[function(require,module,exports){
'use strict';

// MODULES //

var gcd = require( 'compute-gcd' ),
	isArray = require( 'validate.io-array' ),
	isIntegerArray = require( 'validate.io-integer-array' ),
	isFunction = require( 'validate.io-function' );


// LEAST COMMON MULTIPLE //

/**
* FUNCTION: lcm( arr[, clbk] )
*	Computes the least common multiple (lcm).
*
* @param {Number[]|Number} arr - input array of integers
* @param {Function|Number} [accessor] - accessor function for accessing array values
* @returns {Number|Null} least common multiple or null
*/
function lcm() {
	var nargs = arguments.length,
		args,
		clbk,
		arr,
		len,
		a, b,
		i;

	// Copy the input arguments to an array...
	args = new Array( nargs );
	for ( i = 0; i < nargs; i++ ) {
		args[ i ] = arguments[ i ];
	}
	// Have we been provided with integer arguments?
	if ( isIntegerArray( args ) ) {
		if ( nargs === 2 ) {
			a = args[ 0 ];
			b = args[ 1 ];
			if ( a < 0 ) {
				a = -a;
			}
			if ( b < 0 ) {
				b = -b;
			}
			if ( a === 0 || b === 0 ) {
				return 0;
			}
			return ( a/gcd(a,b) ) * b;
		}
		arr = args;
	}
	// If not integers, ensure that the first argument is an array...
	else if ( !isArray( args[ 0 ] ) ) {
		throw new TypeError( 'lcm()::invalid input argument. Must provide an array of integers. Value: `' + args[ 0 ] + '`.' );
	}
	// Have we been provided with more than one argument? If so, ensure that the accessor argument is a function...
	else if ( nargs > 1 ) {
		arr = args[ 0 ];
		clbk = args[ 1 ];
		if ( !isFunction( clbk ) ) {
			throw new TypeError( 'lcm()::invalid input argument. Accessor must be a function. Value: `' + clbk + '`.' );
		}
	}
	// We have been provided an array...
	else {
		arr = args[ 0 ];
	}
	len = arr.length;

	// Check if a sufficient number of values have been provided...
	if ( len < 2 ) {
		return null;
	}
	// If an accessor is provided, extract the array values...
	if ( clbk ) {
		a = new Array( len );
		for ( i = 0; i < len; i++ ) {
			a[ i ] = clbk( arr[ i ], i );
		}
		arr = a;
	}
	// Given an input array, ensure all array values are integers...
	if ( nargs < 3 ) {
		if ( !isIntegerArray( arr ) ) {
			throw new TypeError( 'lcm()::invalid input argument. Accessed array values must be integers. Value: `' + arr + '`.' );
		}
	}
	// Convert any negative integers to positive integers...
	for ( i = 0; i < len; i++ ) {
		a = arr[ i ];
		if ( a < 0 ) {
			arr[ i ] = -a;
		}
	}
	// Exploit the fact that the lcm is an associative function...
	a = arr[ 0 ];
	for ( i = 1; i < len; i++ ) {
		b = arr[ i ];
		if ( a === 0 || b === 0 ) {
			return 0;
		}
		a = ( a/gcd(a,b) ) * b;
	}
	return a;
} // end FUNCTION lcm()


// EXPORTS //

module.exports = lcm;

},{"compute-gcd":13,"validate.io-array":39,"validate.io-function":40,"validate.io-integer-array":41}],15:[function(require,module,exports){
'use strict';

module.exports = function () {
	// data-uri scheme
	// data:[<media type>][;charset=<character set>][;base64],<data>
	return new RegExp(/^(data:)([\w\/\+]+);(charset=[\w-]+|base64).*,(.*)/gi);
};

},{}],16:[function(require,module,exports){
'use strict';

function FFT(size) {
  this.size = size | 0;
  if (this.size <= 1 || (this.size & (this.size - 1)) !== 0)
    throw new Error('FFT size must be a power of two and bigger than 1');

  this._csize = size << 1;

  // NOTE: Use of `var` is intentional for old V8 versions
  var table = new Array(this.size * 2);
  for (var i = 0; i < table.length; i += 2) {
    const angle = Math.PI * i / this.size;
    table[i] = Math.cos(angle);
    table[i + 1] = -Math.sin(angle);
  }
  this.table = table;

  // Find size's power of two
  var power = 0;
  for (var t = 1; this.size > t; t <<= 1)
    power++;

  // Calculate initial step's width:
  //   * If we are full radix-4 - it is 2x smaller to give inital len=8
  //   * Otherwise it is the same as `power` to give len=4
  this._width = power % 2 === 0 ? power - 1 : power;

  // Pre-compute bit-reversal patterns
  this._bitrev = new Array(1 << this._width);
  for (var j = 0; j < this._bitrev.length; j++) {
    this._bitrev[j] = 0;
    for (var shift = 0; shift < this._width; shift += 2) {
      var revShift = this._width - shift - 2;
      this._bitrev[j] |= ((j >>> shift) & 3) << revShift;
    }
  }

  this._out = null;
  this._data = null;
  this._inv = 0;
}
module.exports = FFT;

FFT.prototype.fromComplexArray = function fromComplexArray(complex, storage) {
  var res = storage || new Array(complex.length >>> 1);
  for (var i = 0; i < complex.length; i += 2)
    res[i >>> 1] = complex[i];
  return res;
};

FFT.prototype.createComplexArray = function createComplexArray() {
  const res = new Array(this._csize);
  for (var i = 0; i < res.length; i++)
    res[i] = 0;
  return res;
};

FFT.prototype.toComplexArray = function toComplexArray(input, storage) {
  var res = storage || this.createComplexArray();
  for (var i = 0; i < res.length; i += 2) {
    res[i] = input[i >>> 1];
    res[i + 1] = 0;
  }
  return res;
};

FFT.prototype.completeSpectrum = function completeSpectrum(spectrum) {
  var size = this._csize;
  var half = size >>> 1;
  for (var i = 2; i < half; i += 2) {
    spectrum[size - i] = spectrum[i];
    spectrum[size - i + 1] = -spectrum[i + 1];
  }
};

FFT.prototype.transform = function transform(out, data) {
  if (out === data)
    throw new Error('Input and output buffers must be different');

  this._out = out;
  this._data = data;
  this._inv = 0;
  this._transform4();
  this._out = null;
  this._data = null;
};

FFT.prototype.realTransform = function realTransform(out, data) {
  if (out === data)
    throw new Error('Input and output buffers must be different');

  this._out = out;
  this._data = data;
  this._inv = 0;
  this._realTransform4();
  this._out = null;
  this._data = null;
};

FFT.prototype.inverseTransform = function inverseTransform(out, data) {
  if (out === data)
    throw new Error('Input and output buffers must be different');

  this._out = out;
  this._data = data;
  this._inv = 1;
  this._transform4();
  for (var i = 0; i < out.length; i++)
    out[i] /= this.size;
  this._out = null;
  this._data = null;
};

// radix-4 implementation
//
// NOTE: Uses of `var` are intentional for older V8 version that do not
// support both `let compound assignments` and `const phi`
FFT.prototype._transform4 = function _transform4() {
  var out = this._out;
  var size = this._csize;

  // Initial step (permute and transform)
  var width = this._width;
  var step = 1 << width;
  var len = (size / step) << 1;

  var outOff;
  var t;
  var bitrev = this._bitrev;
  if (len === 4) {
    for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
      const off = bitrev[t];
      this._singleTransform2(outOff, off, step);
    }
  } else {
    // len === 8
    for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
      const off = bitrev[t];
      this._singleTransform4(outOff, off, step);
    }
  }

  // Loop through steps in decreasing order
  var inv = this._inv ? -1 : 1;
  var table = this.table;
  for (step >>= 2; step >= 2; step >>= 2) {
    len = (size / step) << 1;
    var quarterLen = len >>> 2;

    // Loop through offsets in the data
    for (outOff = 0; outOff < size; outOff += len) {
      // Full case
      var limit = outOff + quarterLen;
      for (var i = outOff, k = 0; i < limit; i += 2, k += step) {
        const A = i;
        const B = A + quarterLen;
        const C = B + quarterLen;
        const D = C + quarterLen;

        // Original values
        const Ar = out[A];
        const Ai = out[A + 1];
        const Br = out[B];
        const Bi = out[B + 1];
        const Cr = out[C];
        const Ci = out[C + 1];
        const Dr = out[D];
        const Di = out[D + 1];

        // Middle values
        const MAr = Ar;
        const MAi = Ai;

        const tableBr = table[k];
        const tableBi = inv * table[k + 1];
        const MBr = Br * tableBr - Bi * tableBi;
        const MBi = Br * tableBi + Bi * tableBr;

        const tableCr = table[2 * k];
        const tableCi = inv * table[2 * k + 1];
        const MCr = Cr * tableCr - Ci * tableCi;
        const MCi = Cr * tableCi + Ci * tableCr;

        const tableDr = table[3 * k];
        const tableDi = inv * table[3 * k + 1];
        const MDr = Dr * tableDr - Di * tableDi;
        const MDi = Dr * tableDi + Di * tableDr;

        // Pre-Final values
        const T0r = MAr + MCr;
        const T0i = MAi + MCi;
        const T1r = MAr - MCr;
        const T1i = MAi - MCi;
        const T2r = MBr + MDr;
        const T2i = MBi + MDi;
        const T3r = inv * (MBr - MDr);
        const T3i = inv * (MBi - MDi);

        // Final values
        const FAr = T0r + T2r;
        const FAi = T0i + T2i;

        const FCr = T0r - T2r;
        const FCi = T0i - T2i;

        const FBr = T1r + T3i;
        const FBi = T1i - T3r;

        const FDr = T1r - T3i;
        const FDi = T1i + T3r;

        out[A] = FAr;
        out[A + 1] = FAi;
        out[B] = FBr;
        out[B + 1] = FBi;
        out[C] = FCr;
        out[C + 1] = FCi;
        out[D] = FDr;
        out[D + 1] = FDi;
      }
    }
  }
};

// radix-2 implementation
//
// NOTE: Only called for len=4
FFT.prototype._singleTransform2 = function _singleTransform2(outOff, off,
                                                             step) {
  const out = this._out;
  const data = this._data;

  const evenR = data[off];
  const evenI = data[off + 1];
  const oddR = data[off + step];
  const oddI = data[off + step + 1];

  const leftR = evenR + oddR;
  const leftI = evenI + oddI;
  const rightR = evenR - oddR;
  const rightI = evenI - oddI;

  out[outOff] = leftR;
  out[outOff + 1] = leftI;
  out[outOff + 2] = rightR;
  out[outOff + 3] = rightI;
};

// radix-4
//
// NOTE: Only called for len=8
FFT.prototype._singleTransform4 = function _singleTransform4(outOff, off,
                                                             step) {
  const out = this._out;
  const data = this._data;
  const inv = this._inv ? -1 : 1;
  const step2 = step * 2;
  const step3 = step * 3;

  // Original values
  const Ar = data[off];
  const Ai = data[off + 1];
  const Br = data[off + step];
  const Bi = data[off + step + 1];
  const Cr = data[off + step2];
  const Ci = data[off + step2 + 1];
  const Dr = data[off + step3];
  const Di = data[off + step3 + 1];

  // Pre-Final values
  const T0r = Ar + Cr;
  const T0i = Ai + Ci;
  const T1r = Ar - Cr;
  const T1i = Ai - Ci;
  const T2r = Br + Dr;
  const T2i = Bi + Di;
  const T3r = inv * (Br - Dr);
  const T3i = inv * (Bi - Di);

  // Final values
  const FAr = T0r + T2r;
  const FAi = T0i + T2i;

  const FBr = T1r + T3i;
  const FBi = T1i - T3r;

  const FCr = T0r - T2r;
  const FCi = T0i - T2i;

  const FDr = T1r - T3i;
  const FDi = T1i + T3r;

  out[outOff] = FAr;
  out[outOff + 1] = FAi;
  out[outOff + 2] = FBr;
  out[outOff + 3] = FBi;
  out[outOff + 4] = FCr;
  out[outOff + 5] = FCi;
  out[outOff + 6] = FDr;
  out[outOff + 7] = FDi;
};

// Real input radix-4 implementation
FFT.prototype._realTransform4 = function _realTransform4() {
  var out = this._out;
  var size = this._csize;

  // Initial step (permute and transform)
  var width = this._width;
  var step = 1 << width;
  var len = (size / step) << 1;

  var outOff;
  var t;
  var bitrev = this._bitrev;
  if (len === 4) {
    for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
      const off = bitrev[t];
      this._singleRealTransform2(outOff, off >>> 1, step >>> 1);
    }
  } else {
    // len === 8
    for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
      const off = bitrev[t];
      this._singleRealTransform4(outOff, off >>> 1, step >>> 1);
    }
  }

  // Loop through steps in decreasing order
  var inv = this._inv ? -1 : 1;
  var table = this.table;
  for (step >>= 2; step >= 2; step >>= 2) {
    len = (size / step) << 1;
    var halfLen = len >>> 1;
    var quarterLen = halfLen >>> 1;
    var hquarterLen = quarterLen >>> 1;

    // Loop through offsets in the data
    for (outOff = 0; outOff < size; outOff += len) {
      for (var i = 0, k = 0; i <= hquarterLen; i += 2, k += step) {
        var A = outOff + i;
        var B = A + quarterLen;
        var C = B + quarterLen;
        var D = C + quarterLen;

        // Original values
        var Ar = out[A];
        var Ai = out[A + 1];
        var Br = out[B];
        var Bi = out[B + 1];
        var Cr = out[C];
        var Ci = out[C + 1];
        var Dr = out[D];
        var Di = out[D + 1];

        // Middle values
        var MAr = Ar;
        var MAi = Ai;

        var tableBr = table[k];
        var tableBi = inv * table[k + 1];
        var MBr = Br * tableBr - Bi * tableBi;
        var MBi = Br * tableBi + Bi * tableBr;

        var tableCr = table[2 * k];
        var tableCi = inv * table[2 * k + 1];
        var MCr = Cr * tableCr - Ci * tableCi;
        var MCi = Cr * tableCi + Ci * tableCr;

        var tableDr = table[3 * k];
        var tableDi = inv * table[3 * k + 1];
        var MDr = Dr * tableDr - Di * tableDi;
        var MDi = Dr * tableDi + Di * tableDr;

        // Pre-Final values
        var T0r = MAr + MCr;
        var T0i = MAi + MCi;
        var T1r = MAr - MCr;
        var T1i = MAi - MCi;
        var T2r = MBr + MDr;
        var T2i = MBi + MDi;
        var T3r = inv * (MBr - MDr);
        var T3i = inv * (MBi - MDi);

        // Final values
        var FAr = T0r + T2r;
        var FAi = T0i + T2i;

        var FBr = T1r + T3i;
        var FBi = T1i - T3r;

        out[A] = FAr;
        out[A + 1] = FAi;
        out[B] = FBr;
        out[B + 1] = FBi;

        // Output final middle point
        if (i === 0) {
          var FCr = T0r - T2r;
          var FCi = T0i - T2i;
          out[C] = FCr;
          out[C + 1] = FCi;
          continue;
        }

        // Do not overwrite ourselves
        if (i === hquarterLen)
          continue;

        // In the flipped case:
        // MAi = -MAi
        // MBr=-MBi, MBi=-MBr
        // MCr=-MCr
        // MDr=MDi, MDi=MDr
        var ST0r = T1r;
        var ST0i = -T1i;
        var ST1r = T0r;
        var ST1i = -T0i;
        var ST2r = -inv * T3i;
        var ST2i = -inv * T3r;
        var ST3r = -inv * T2i;
        var ST3i = -inv * T2r;

        var SFAr = ST0r + ST2r;
        var SFAi = ST0i + ST2i;

        var SFBr = ST1r + ST3i;
        var SFBi = ST1i - ST3r;

        var SA = outOff + quarterLen - i;
        var SB = outOff + halfLen - i;

        out[SA] = SFAr;
        out[SA + 1] = SFAi;
        out[SB] = SFBr;
        out[SB + 1] = SFBi;
      }
    }
  }
};

// radix-2 implementation
//
// NOTE: Only called for len=4
FFT.prototype._singleRealTransform2 = function _singleRealTransform2(outOff,
                                                                     off,
                                                                     step) {
  const out = this._out;
  const data = this._data;

  const evenR = data[off];
  const oddR = data[off + step];

  const leftR = evenR + oddR;
  const rightR = evenR - oddR;

  out[outOff] = leftR;
  out[outOff + 1] = 0;
  out[outOff + 2] = rightR;
  out[outOff + 3] = 0;
};

// radix-4
//
// NOTE: Only called for len=8
FFT.prototype._singleRealTransform4 = function _singleRealTransform4(outOff,
                                                                     off,
                                                                     step) {
  const out = this._out;
  const data = this._data;
  const inv = this._inv ? -1 : 1;
  const step2 = step * 2;
  const step3 = step * 3;

  // Original values
  const Ar = data[off];
  const Br = data[off + step];
  const Cr = data[off + step2];
  const Dr = data[off + step3];

  // Pre-Final values
  const T0r = Ar + Cr;
  const T1r = Ar - Cr;
  const T2r = Br + Dr;
  const T3r = inv * (Br - Dr);

  // Final values
  const FAr = T0r + T2r;

  const FBr = T1r;
  const FBi = -T3r;

  const FCr = T0r - T2r;

  const FDr = T1r;
  const FDi = T3r;

  out[outOff] = FAr;
  out[outOff + 1] = 0;
  out[outOff + 2] = FBr;
  out[outOff + 3] = FBi;
  out[outOff + 4] = FCr;
  out[outOff + 5] = 0;
  out[outOff + 6] = FDr;
  out[outOff + 7] = FDi;
};

},{}],17:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],18:[function(require,module,exports){
/**
 * @module  is-audio-buffer
 */
'use strict';

module.exports = function isAudioBuffer (buffer) {
	//the guess is duck-typing
	return buffer != null
	&& typeof buffer.length === 'number'
	&& typeof buffer.sampleRate === 'number' //swims like AudioBuffer
	&& typeof buffer.getChannelData === 'function' //quacks like AudioBuffer
	// && buffer.copyToChannel
	// && buffer.copyFromChannel
	&& typeof buffer.duration === 'number'
};

},{}],19:[function(require,module,exports){
module.exports = true;
},{}],20:[function(require,module,exports){
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
module.exports = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
}

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}

},{}],21:[function(require,module,exports){
'use strict';

var re = require('data-uri-regex');

module.exports = function (data) {
	return (data && re().test(data)) === true;
};

},{"data-uri-regex":15}],22:[function(require,module,exports){
'use strict';
var toString = Object.prototype.toString;

module.exports = function (x) {
	var prototype;
	return toString.call(x) === '[object Object]' && (prototype = Object.getPrototypeOf(x), prototype === null || prototype === Object.getPrototypeOf({}));
};

},{}],23:[function(require,module,exports){
module.exports = function (args, opts) {
    if (!opts) opts = {};
    
    var flags = { bools : {}, strings : {}, unknownFn: null };

    if (typeof opts['unknown'] === 'function') {
        flags.unknownFn = opts['unknown'];
    }

    if (typeof opts['boolean'] === 'boolean' && opts['boolean']) {
      flags.allBools = true;
    } else {
      [].concat(opts['boolean']).filter(Boolean).forEach(function (key) {
          flags.bools[key] = true;
      });
    }
    
    var aliases = {};
    Object.keys(opts.alias || {}).forEach(function (key) {
        aliases[key] = [].concat(opts.alias[key]);
        aliases[key].forEach(function (x) {
            aliases[x] = [key].concat(aliases[key].filter(function (y) {
                return x !== y;
            }));
        });
    });

    [].concat(opts.string).filter(Boolean).forEach(function (key) {
        flags.strings[key] = true;
        if (aliases[key]) {
            flags.strings[aliases[key]] = true;
        }
     });

    var defaults = opts['default'] || {};
    
    var argv = { _ : [] };
    Object.keys(flags.bools).forEach(function (key) {
        setArg(key, defaults[key] === undefined ? false : defaults[key]);
    });
    
    var notFlags = [];

    if (args.indexOf('--') !== -1) {
        notFlags = args.slice(args.indexOf('--')+1);
        args = args.slice(0, args.indexOf('--'));
    }

    function argDefined(key, arg) {
        return (flags.allBools && /^--[^=]+$/.test(arg)) ||
            flags.strings[key] || flags.bools[key] || aliases[key];
    }

    function setArg (key, val, arg) {
        if (arg && flags.unknownFn && !argDefined(key, arg)) {
            if (flags.unknownFn(arg) === false) return;
        }

        var value = !flags.strings[key] && isNumber(val)
            ? Number(val) : val
        ;
        setKey(argv, key.split('.'), value);
        
        (aliases[key] || []).forEach(function (x) {
            setKey(argv, x.split('.'), value);
        });
    }

    function setKey (obj, keys, value) {
        var o = obj;
        keys.slice(0,-1).forEach(function (key) {
            if (o[key] === undefined) o[key] = {};
            o = o[key];
        });

        var key = keys[keys.length - 1];
        if (o[key] === undefined || flags.bools[key] || typeof o[key] === 'boolean') {
            o[key] = value;
        }
        else if (Array.isArray(o[key])) {
            o[key].push(value);
        }
        else {
            o[key] = [ o[key], value ];
        }
    }
    
    function aliasIsBoolean(key) {
      return aliases[key].some(function (x) {
          return flags.bools[x];
      });
    }

    for (var i = 0; i < args.length; i++) {
        var arg = args[i];
        
        if (/^--.+=/.test(arg)) {
            // Using [\s\S] instead of . because js doesn't support the
            // 'dotall' regex modifier. See:
            // http://stackoverflow.com/a/1068308/13216
            var m = arg.match(/^--([^=]+)=([\s\S]*)$/);
            var key = m[1];
            var value = m[2];
            if (flags.bools[key]) {
                value = value !== 'false';
            }
            setArg(key, value, arg);
        }
        else if (/^--no-.+/.test(arg)) {
            var key = arg.match(/^--no-(.+)/)[1];
            setArg(key, false, arg);
        }
        else if (/^--.+/.test(arg)) {
            var key = arg.match(/^--(.+)/)[1];
            var next = args[i + 1];
            if (next !== undefined && !/^-/.test(next)
            && !flags.bools[key]
            && !flags.allBools
            && (aliases[key] ? !aliasIsBoolean(key) : true)) {
                setArg(key, next, arg);
                i++;
            }
            else if (/^(true|false)$/.test(next)) {
                setArg(key, next === 'true', arg);
                i++;
            }
            else {
                setArg(key, flags.strings[key] ? '' : true, arg);
            }
        }
        else if (/^-[^-]+/.test(arg)) {
            var letters = arg.slice(1,-1).split('');
            
            var broken = false;
            for (var j = 0; j < letters.length; j++) {
                var next = arg.slice(j+2);
                
                if (next === '-') {
                    setArg(letters[j], next, arg)
                    continue;
                }
                
                if (/[A-Za-z]/.test(letters[j]) && /=/.test(next)) {
                    setArg(letters[j], next.split('=')[1], arg);
                    broken = true;
                    break;
                }
                
                if (/[A-Za-z]/.test(letters[j])
                && /-?\d+(\.\d*)?(e-?\d+)?$/.test(next)) {
                    setArg(letters[j], next, arg);
                    broken = true;
                    break;
                }
                
                if (letters[j+1] && letters[j+1].match(/\W/)) {
                    setArg(letters[j], arg.slice(j+2), arg);
                    broken = true;
                    break;
                }
                else {
                    setArg(letters[j], flags.strings[letters[j]] ? '' : true, arg);
                }
            }
            
            var key = arg.slice(-1)[0];
            if (!broken && key !== '-') {
                if (args[i+1] && !/^(-|--)[^-]/.test(args[i+1])
                && !flags.bools[key]
                && (aliases[key] ? !aliasIsBoolean(key) : true)) {
                    setArg(key, args[i+1], arg);
                    i++;
                }
                else if (args[i+1] && /true|false/.test(args[i+1])) {
                    setArg(key, args[i+1] === 'true', arg);
                    i++;
                }
                else {
                    setArg(key, flags.strings[key] ? '' : true, arg);
                }
            }
        }
        else {
            if (!flags.unknownFn || flags.unknownFn(arg) !== false) {
                argv._.push(
                    flags.strings['_'] || !isNumber(arg) ? arg : Number(arg)
                );
            }
            if (opts.stopEarly) {
                argv._.push.apply(argv._, args.slice(i + 1));
                break;
            }
        }
    }
    
    Object.keys(defaults).forEach(function (key) {
        if (!hasKey(argv, key.split('.'))) {
            setKey(argv, key.split('.'), defaults[key]);
            
            (aliases[key] || []).forEach(function (x) {
                setKey(argv, x.split('.'), defaults[key]);
            });
        }
    });
    
    if (opts['--']) {
        argv['--'] = new Array();
        notFlags.forEach(function(key) {
            argv['--'].push(key);
        });
    }
    else {
        notFlags.forEach(function(key) {
            argv._.push(key);
        });
    }

    return argv;
};

function hasKey (obj, keys) {
    var o = obj;
    keys.slice(0,-1).forEach(function (key) {
        o = (o[key] || {});
    });

    var key = keys[keys.length - 1];
    return key in o;
}

function isNumber (x) {
    if (typeof x === 'number') return true;
    if (/^0x[0-9a-f]+$/i.test(x)) return true;
    return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(x);
}


},{}],24:[function(require,module,exports){
/** @module negative-index */
var isNeg = require('negative-zero');

module.exports = function negIdx (idx, length) {
	return idx == null ? 0 : isNeg(idx) ? length : idx <= -length ? 0 : idx < 0 ? (length + (idx % length)) : Math.min(length, idx);
}

},{"negative-zero":25}],25:[function(require,module,exports){
'use strict';
module.exports = x => Object.is(x, -0);

},{}],26:[function(require,module,exports){
/*
object-assign
(c) Sindre Sorhus
@license MIT
*/

'use strict';
/* eslint-disable no-unused-vars */
var getOwnPropertySymbols = Object.getOwnPropertySymbols;
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (err) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

module.exports = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (getOwnPropertySymbols) {
			symbols = getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

},{}],27:[function(require,module,exports){
(function (Buffer){
/**
 * @module  pcm-util
 */
'use strict'

var toArrayBuffer = require('to-array-buffer')
var AudioBuffer = require('audio-buffer')
var os = require('os')
var isAudioBuffer = require('is-audio-buffer')



/**
 * Default pcm format values
 */
var defaultFormat = {
	signed: true,
	float: false,
	bitDepth: 16,
	byteOrder: os.endianness instanceof Function ? os.endianness() : 'LE',
	channels: 2,
	sampleRate: 44100,
	interleaved: true,
	samplesPerFrame: 1024,
	id: 'S_16_LE_2_44100_I',
	max: 32678,
	min: -32768
}


/**
 * Just a list of reserved property names of format
 */
var formatProperties = Object.keys(defaultFormat)


/** Correct default format values */
normalize(defaultFormat)


/**
 * Get format info from any object, unnormalized.
 */
function getFormat (obj) {
	//undefined format - no format-related props, for sure
	if (!obj) return {}

	//if is string - parse format
	if (typeof obj === 'string' || obj.id) {
		return parse(obj.id || obj)
	}

	//if audio buffer - we know it’s format
	else if (isAudioBuffer(obj)) {
		var arrayFormat = fromTypedArray(obj.getChannelData(0))
		return {
			sampleRate: obj.sampleRate,
			channels: obj.numberOfChannels,
			samplesPerFrame: obj.length,
			float: true,
			signed: true,
			bitDepth: arrayFormat.bitDepth
		}
	}

	//if is array - detect format
	else if (ArrayBuffer.isView(obj)) {
		return fromTypedArray(obj)
	}

	//FIXME: add AudioNode, stream detection

	//else detect from obhect
	return fromObject(obj)
}


/**
 * Get format id string.
 * Inspired by https://github.com/xdissent/node-alsa/blob/master/src/constants.coffee
 */
function stringify (format) {
	//TODO: extend possible special formats
	var result = []

	//(S|U)(8|16|24|32)_(LE|BE)?
	result.push(format.float ? 'F' : (format.signed ? 'S' : 'U'))
	result.push(format.bitDepth)
	result.push(format.byteOrder)
	result.push(format.channels)
	result.push(format.sampleRate)
	result.push(format.interleaved ? 'I' : 'N')

	return result.join('_')
}


/**
 * Return format object from the format ID.
 * Returned format is not normalized for performance purposes (~10 times)
 * http://jsperf.com/parse-vs-extend/4
 */
function parse (str) {
	var params = str.split('_')
	return {
		float: params[0] === 'F',
		signed: params[0] === 'S',
		bitDepth: parseInt(params[1]),
		byteOrder: params[2],
		channels: parseInt(params[3]),
		sampleRate: parseInt(params[4]),
		interleaved: params[5] === 'I'
	}
}


/**
 * Whether one format is equal to another
 */
function equal (a, b) {
	return (a.id || stringify(a)) === (b.id || stringify(b))
}


/**
 * Normalize format, mutable.
 * Precalculate format params: methodSuffix, id, maxInt.
 * Fill absent params.
 */
function normalize (format) {
	if (!format) format = {}

	//bring default format values, if not present
	formatProperties.forEach(function (key) {
		if (format[key] == null) {
			format[key] = defaultFormat[key]
		}
	})

	//ensure float values
	if (format.float) {
		if (format.bitDepth != 64) format.bitDepth = 32
		format.signed = true
	}

	//for words byte length does not matter
	else if (format.bitDepth <= 8) format.byteOrder = ''

	//max/min values
	if (format.float) {
		format.min = -1
		format.max = 1
	}
	else {
		format.max = Math.pow(2, format.bitDepth) - 1
		format.min = 0
		if (format.signed) {
			format.min -= Math.ceil(format.max * 0.5)
			format.max -= Math.ceil(format.max * 0.5)
		}
	}

	//calc id
	format.id = stringify(format)

	return format
}


/** Convert AudioBuffer to Buffer with specified format */
function toBuffer (audioBuffer, format) {
	if (!isNormalized(format)) format = normalize(format)

	var data = toArrayBuffer(audioBuffer)
	var arrayFormat = fromTypedArray(audioBuffer.getChannelData(0))

	var buffer = convert(data, {
		float: true,
		channels: audioBuffer.numberOfChannels,
		sampleRate: audioBuffer.sampleRate,
		interleaved: false,
		bitDepth: arrayFormat.bitDepth
	}, format)

	return buffer
}


/** Convert Buffer to AudioBuffer with specified format */
function toAudioBuffer (buffer, format) {
	if (!isNormalized(format)) format = normalize(format)

	buffer = convert(buffer, format, {
		channels: format.channels,
		sampleRate: format.sampleRate,
		interleaved: false,
		float: true
	})

	return new AudioBuffer(format.channels, buffer, format.sampleRate)
}


/**
 * Convert buffer from format A to format B.
 */
function convert (buffer, from, to) {
	//ensure formats are full
	if (!isNormalized(from)) from = normalize(from)
	if (!isNormalized(to)) to = normalize(to)

	//ignore needless conversion
	if (equal(from ,to)) {
		return buffer
	}

	//convert buffer to arrayBuffer
	var data = toArrayBuffer(buffer)

	//create containers for conversion
	var fromArray = new (arrayClass(from))(data)

	//toArray is automatically filled with mapped values
	//but in some cases mapped badly, e. g. float → int(round + rotate)
	var toArray = new (arrayClass(to))(fromArray)

	//if range differ, we should apply more thoughtful mapping
	if (from.max !== to.max) {
		fromArray.forEach(function (value, idx) {
			//ignore not changed range
			//bring to 0..1
			var normalValue = (value - from.min) / (from.max - from.min)

			//bring to new format ranges
			value = normalValue * (to.max - to.min) + to.min

			//clamp (buffers does not like values outside of bounds)
			toArray[idx] = Math.max(to.min, Math.min(to.max, value))
		})
	}

	//reinterleave, if required
	if (from.interleaved != to.interleaved) {
		var channels = from.channels
		var len = Math.floor(fromArray.length / channels)

		//deinterleave
		if (from.interleaved && !to.interleaved) {
			toArray = toArray.map(function (value, idx, data) {
				var targetOffset = idx % len
				var targetChannel = ~~(idx / len)

				return data[targetOffset * channels + targetChannel]
			})
		}
		//interleave
		else if (!from.interleaved && to.interleaved) {
			toArray = toArray.map(function (value, idx, data) {
				var targetOffset = ~~(idx / channels)
				var targetChannel = idx % channels

				return data[targetChannel * len + targetOffset]
			})
		}
	}

	//ensure endianness
	if (!to.float && from.byteOrder !== to.byteOrder) {
		var le = to.byteOrder === 'LE'
		var view = new DataView(toArray.buffer)
		var step = to.bitDepth / 8
		var methodName = 'set' + getDataViewSuffix(to)
		for (var i = 0, l = toArray.length; i < l; i++) {
			view[methodName](i*step, toArray[i], le)
		}
	}

	return new Buffer(toArray.buffer)
}


/**
 * Check whether format is normalized, at least once
 */
function isNormalized (format) {
	return format && format.id
}


/**
 * Create typed array for the format, filling with the data (ArrayBuffer)
 */
function arrayClass (format) {
	if (!isNormalized(format)) format = normalize(format)

	if (format.float) {
		if (format.bitDepth > 32) {
			return Float64Array
		}
		else {
			return Float32Array
		}
	}
	else {
		if (format.bitDepth === 32) {
			return format.signed ? Int32Array : Uint32Array
		}
		else if (format.bitDepth === 8) {
			return format.signed ? Int8Array : Uint8Array
		}
		//default case
		else {
			return format.signed ? Int16Array : Uint16Array
		}
	}
}


/**
 * Get format info from the array type
 */
function fromTypedArray (array) {
	if (array instanceof Int8Array) {
		return {
			float: false,
			signed: true,
			bitDepth: 8
		}
	}
	if ((array instanceof Uint8Array) || (array instanceof Uint8ClampedArray)) {
		return {
			float: false,
			signed: false,
			bitDepth: 8
		}
	}
	if (array instanceof Int16Array) {
		return {
			float: false,
			signed: true,
			bitDepth: 16
		}
	}
	if (array instanceof Uint16Array) {
		return {
			float: false,
			signed: false,
			bitDepth: 16
		}
	}
	if (array instanceof Int32Array) {
		return {
			float: false,
			signed: true,
			bitDepth: 32
		}
	}
	if (array instanceof Uint32Array) {
		return {
			float: false,
			signed: false,
			bitDepth: 32
		}
	}
	if (array instanceof Float32Array) {
		return {
			float: true,
			signed: false,
			bitDepth: 32
		}
	}
	if (array instanceof Float64Array) {
		return {
			float: true,
			signed: false,
			bitDepth: 64
		}
	}

	//other dataview types are Uint8Arrays
	return {
		float: false,
		signed: false,
		bitDepth: 8
	}
}


/**
 * Retrieve format info from object
 */
function fromObject (obj) {
	//else retrieve format properties from object
	var format = {}

	formatProperties.forEach(function (key) {
		if (obj[key] != null) format[key] = obj[key]
	})

	//some AudioNode/etc-specific options
	if (obj.channelCount != null) {
		format.channels = obj.channelCount
	}

	return format
}


/**
 * e. g. Float32, Uint16LE
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView
 */
function getDataViewSuffix (format) {
	return (format.float ? 'Float' : format.signed ? 'Int' : 'Uint') + format.bitDepth
}



module.exports = {
	defaults: defaultFormat,
	format: getFormat,
	normalize: normalize,
	equal: equal,
	toBuffer: toBuffer,
	toAudioBuffer: toAudioBuffer,
	convert: convert
}

}).call(this,require("buffer").Buffer)
},{"audio-buffer":28,"buffer":197,"is-audio-buffer":18,"os":204,"to-array-buffer":37}],28:[function(require,module,exports){
arguments[4][6][0].apply(exports,arguments)
},{"audio-context":10,"buffer-to-arraybuffer":11,"dup":6,"is-audio-buffer":18,"is-browser":19,"is-buffer":20,"is-plain-obj":22}],29:[function(require,module,exports){
'use strict';

module.exports = require('./lib')

},{"./lib":34}],30:[function(require,module,exports){
'use strict';

var asap = require('asap/raw');

function noop() {}

// States:
//
// 0 - pending
// 1 - fulfilled with _value
// 2 - rejected with _value
// 3 - adopted the state of another promise, _value
//
// once the state is no longer pending (0) it is immutable

// All `_` prefixed properties will be reduced to `_{random number}`
// at build time to obfuscate them and discourage their use.
// We don't use symbols or Object.defineProperty to fully hide them
// because the performance isn't good enough.


// to avoid using try/catch inside critical functions, we
// extract them to here.
var LAST_ERROR = null;
var IS_ERROR = {};
function getThen(obj) {
  try {
    return obj.then;
  } catch (ex) {
    LAST_ERROR = ex;
    return IS_ERROR;
  }
}

function tryCallOne(fn, a) {
  try {
    return fn(a);
  } catch (ex) {
    LAST_ERROR = ex;
    return IS_ERROR;
  }
}
function tryCallTwo(fn, a, b) {
  try {
    fn(a, b);
  } catch (ex) {
    LAST_ERROR = ex;
    return IS_ERROR;
  }
}

module.exports = Promise;

function Promise(fn) {
  if (typeof this !== 'object') {
    throw new TypeError('Promises must be constructed via new');
  }
  if (typeof fn !== 'function') {
    throw new TypeError('Promise constructor\'s argument is not a function');
  }
  this._h = 0;
  this._i = 0;
  this._j = null;
  this._k = null;
  if (fn === noop) return;
  doResolve(fn, this);
}
Promise._l = null;
Promise._m = null;
Promise._n = noop;

Promise.prototype.then = function(onFulfilled, onRejected) {
  if (this.constructor !== Promise) {
    return safeThen(this, onFulfilled, onRejected);
  }
  var res = new Promise(noop);
  handle(this, new Handler(onFulfilled, onRejected, res));
  return res;
};

function safeThen(self, onFulfilled, onRejected) {
  return new self.constructor(function (resolve, reject) {
    var res = new Promise(noop);
    res.then(resolve, reject);
    handle(self, new Handler(onFulfilled, onRejected, res));
  });
}
function handle(self, deferred) {
  while (self._i === 3) {
    self = self._j;
  }
  if (Promise._l) {
    Promise._l(self);
  }
  if (self._i === 0) {
    if (self._h === 0) {
      self._h = 1;
      self._k = deferred;
      return;
    }
    if (self._h === 1) {
      self._h = 2;
      self._k = [self._k, deferred];
      return;
    }
    self._k.push(deferred);
    return;
  }
  handleResolved(self, deferred);
}

function handleResolved(self, deferred) {
  asap(function() {
    var cb = self._i === 1 ? deferred.onFulfilled : deferred.onRejected;
    if (cb === null) {
      if (self._i === 1) {
        resolve(deferred.promise, self._j);
      } else {
        reject(deferred.promise, self._j);
      }
      return;
    }
    var ret = tryCallOne(cb, self._j);
    if (ret === IS_ERROR) {
      reject(deferred.promise, LAST_ERROR);
    } else {
      resolve(deferred.promise, ret);
    }
  });
}
function resolve(self, newValue) {
  // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
  if (newValue === self) {
    return reject(
      self,
      new TypeError('A promise cannot be resolved with itself.')
    );
  }
  if (
    newValue &&
    (typeof newValue === 'object' || typeof newValue === 'function')
  ) {
    var then = getThen(newValue);
    if (then === IS_ERROR) {
      return reject(self, LAST_ERROR);
    }
    if (
      then === self.then &&
      newValue instanceof Promise
    ) {
      self._i = 3;
      self._j = newValue;
      finale(self);
      return;
    } else if (typeof then === 'function') {
      doResolve(then.bind(newValue), self);
      return;
    }
  }
  self._i = 1;
  self._j = newValue;
  finale(self);
}

function reject(self, newValue) {
  self._i = 2;
  self._j = newValue;
  if (Promise._m) {
    Promise._m(self, newValue);
  }
  finale(self);
}
function finale(self) {
  if (self._h === 1) {
    handle(self, self._k);
    self._k = null;
  }
  if (self._h === 2) {
    for (var i = 0; i < self._k.length; i++) {
      handle(self, self._k[i]);
    }
    self._k = null;
  }
}

function Handler(onFulfilled, onRejected, promise){
  this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
  this.onRejected = typeof onRejected === 'function' ? onRejected : null;
  this.promise = promise;
}

/**
 * Take a potentially misbehaving resolver function and make sure
 * onFulfilled and onRejected are only called once.
 *
 * Makes no guarantees about asynchrony.
 */
function doResolve(fn, promise) {
  var done = false;
  var res = tryCallTwo(fn, function (value) {
    if (done) return;
    done = true;
    resolve(promise, value);
  }, function (reason) {
    if (done) return;
    done = true;
    reject(promise, reason);
  });
  if (!done && res === IS_ERROR) {
    done = true;
    reject(promise, LAST_ERROR);
  }
}

},{"asap/raw":3}],31:[function(require,module,exports){
'use strict';

var Promise = require('./core.js');

module.exports = Promise;
Promise.prototype.done = function (onFulfilled, onRejected) {
  var self = arguments.length ? this.then.apply(this, arguments) : this;
  self.then(null, function (err) {
    setTimeout(function () {
      throw err;
    }, 0);
  });
};

},{"./core.js":30}],32:[function(require,module,exports){
'use strict';

//This file contains the ES6 extensions to the core Promises/A+ API

var Promise = require('./core.js');

module.exports = Promise;

/* Static Functions */

var TRUE = valuePromise(true);
var FALSE = valuePromise(false);
var NULL = valuePromise(null);
var UNDEFINED = valuePromise(undefined);
var ZERO = valuePromise(0);
var EMPTYSTRING = valuePromise('');

function valuePromise(value) {
  var p = new Promise(Promise._n);
  p._i = 1;
  p._j = value;
  return p;
}
Promise.resolve = function (value) {
  if (value instanceof Promise) return value;

  if (value === null) return NULL;
  if (value === undefined) return UNDEFINED;
  if (value === true) return TRUE;
  if (value === false) return FALSE;
  if (value === 0) return ZERO;
  if (value === '') return EMPTYSTRING;

  if (typeof value === 'object' || typeof value === 'function') {
    try {
      var then = value.then;
      if (typeof then === 'function') {
        return new Promise(then.bind(value));
      }
    } catch (ex) {
      return new Promise(function (resolve, reject) {
        reject(ex);
      });
    }
  }
  return valuePromise(value);
};

Promise.all = function (arr) {
  var args = Array.prototype.slice.call(arr);

  return new Promise(function (resolve, reject) {
    if (args.length === 0) return resolve([]);
    var remaining = args.length;
    function res(i, val) {
      if (val && (typeof val === 'object' || typeof val === 'function')) {
        if (val instanceof Promise && val.then === Promise.prototype.then) {
          while (val._i === 3) {
            val = val._j;
          }
          if (val._i === 1) return res(i, val._j);
          if (val._i === 2) reject(val._j);
          val.then(function (val) {
            res(i, val);
          }, reject);
          return;
        } else {
          var then = val.then;
          if (typeof then === 'function') {
            var p = new Promise(then.bind(val));
            p.then(function (val) {
              res(i, val);
            }, reject);
            return;
          }
        }
      }
      args[i] = val;
      if (--remaining === 0) {
        resolve(args);
      }
    }
    for (var i = 0; i < args.length; i++) {
      res(i, args[i]);
    }
  });
};

Promise.reject = function (value) {
  return new Promise(function (resolve, reject) {
    reject(value);
  });
};

Promise.race = function (values) {
  return new Promise(function (resolve, reject) {
    values.forEach(function(value){
      Promise.resolve(value).then(resolve, reject);
    });
  });
};

/* Prototype Methods */

Promise.prototype['catch'] = function (onRejected) {
  return this.then(null, onRejected);
};

},{"./core.js":30}],33:[function(require,module,exports){
'use strict';

var Promise = require('./core.js');

module.exports = Promise;
Promise.prototype.finally = function (f) {
  return this.then(function (value) {
    return Promise.resolve(f()).then(function () {
      return value;
    });
  }, function (err) {
    return Promise.resolve(f()).then(function () {
      throw err;
    });
  });
};

},{"./core.js":30}],34:[function(require,module,exports){
'use strict';

module.exports = require('./core.js');
require('./done.js');
require('./finally.js');
require('./es6-extensions.js');
require('./node-extensions.js');
require('./synchronous.js');

},{"./core.js":30,"./done.js":31,"./es6-extensions.js":32,"./finally.js":33,"./node-extensions.js":35,"./synchronous.js":36}],35:[function(require,module,exports){
'use strict';

// This file contains then/promise specific extensions that are only useful
// for node.js interop

var Promise = require('./core.js');
var asap = require('asap');

module.exports = Promise;

/* Static Functions */

Promise.denodeify = function (fn, argumentCount) {
  if (
    typeof argumentCount === 'number' && argumentCount !== Infinity
  ) {
    return denodeifyWithCount(fn, argumentCount);
  } else {
    return denodeifyWithoutCount(fn);
  }
};

var callbackFn = (
  'function (err, res) {' +
  'if (err) { rj(err); } else { rs(res); }' +
  '}'
);
function denodeifyWithCount(fn, argumentCount) {
  var args = [];
  for (var i = 0; i < argumentCount; i++) {
    args.push('a' + i);
  }
  var body = [
    'return function (' + args.join(',') + ') {',
    'var self = this;',
    'return new Promise(function (rs, rj) {',
    'var res = fn.call(',
    ['self'].concat(args).concat([callbackFn]).join(','),
    ');',
    'if (res &&',
    '(typeof res === "object" || typeof res === "function") &&',
    'typeof res.then === "function"',
    ') {rs(res);}',
    '});',
    '};'
  ].join('');
  return Function(['Promise', 'fn'], body)(Promise, fn);
}
function denodeifyWithoutCount(fn) {
  var fnLength = Math.max(fn.length - 1, 3);
  var args = [];
  for (var i = 0; i < fnLength; i++) {
    args.push('a' + i);
  }
  var body = [
    'return function (' + args.join(',') + ') {',
    'var self = this;',
    'var args;',
    'var argLength = arguments.length;',
    'if (arguments.length > ' + fnLength + ') {',
    'args = new Array(arguments.length + 1);',
    'for (var i = 0; i < arguments.length; i++) {',
    'args[i] = arguments[i];',
    '}',
    '}',
    'return new Promise(function (rs, rj) {',
    'var cb = ' + callbackFn + ';',
    'var res;',
    'switch (argLength) {',
    args.concat(['extra']).map(function (_, index) {
      return (
        'case ' + (index) + ':' +
        'res = fn.call(' + ['self'].concat(args.slice(0, index)).concat('cb').join(',') + ');' +
        'break;'
      );
    }).join(''),
    'default:',
    'args[argLength] = cb;',
    'res = fn.apply(self, args);',
    '}',
    
    'if (res &&',
    '(typeof res === "object" || typeof res === "function") &&',
    'typeof res.then === "function"',
    ') {rs(res);}',
    '});',
    '};'
  ].join('');

  return Function(
    ['Promise', 'fn'],
    body
  )(Promise, fn);
}

Promise.nodeify = function (fn) {
  return function () {
    var args = Array.prototype.slice.call(arguments);
    var callback =
      typeof args[args.length - 1] === 'function' ? args.pop() : null;
    var ctx = this;
    try {
      return fn.apply(this, arguments).nodeify(callback, ctx);
    } catch (ex) {
      if (callback === null || typeof callback == 'undefined') {
        return new Promise(function (resolve, reject) {
          reject(ex);
        });
      } else {
        asap(function () {
          callback.call(ctx, ex);
        })
      }
    }
  }
};

Promise.prototype.nodeify = function (callback, ctx) {
  if (typeof callback != 'function') return this;

  this.then(function (value) {
    asap(function () {
      callback.call(ctx, null, value);
    });
  }, function (err) {
    asap(function () {
      callback.call(ctx, err);
    });
  });
};

},{"./core.js":30,"asap":2}],36:[function(require,module,exports){
'use strict';

var Promise = require('./core.js');

module.exports = Promise;
Promise.enableSynchronous = function () {
  Promise.prototype.isPending = function() {
    return this.getState() == 0;
  };

  Promise.prototype.isFulfilled = function() {
    return this.getState() == 1;
  };

  Promise.prototype.isRejected = function() {
    return this.getState() == 2;
  };

  Promise.prototype.getValue = function () {
    if (this._i === 3) {
      return this._j.getValue();
    }

    if (!this.isFulfilled()) {
      throw new Error('Cannot get a value of an unfulfilled promise.');
    }

    return this._j;
  };

  Promise.prototype.getReason = function () {
    if (this._i === 3) {
      return this._j.getReason();
    }

    if (!this.isRejected()) {
      throw new Error('Cannot get a rejection reason of a non-rejected promise.');
    }

    return this._j;
  };

  Promise.prototype.getState = function () {
    if (this._i === 3) {
      return this._j.getState();
    }
    if (this._i === -1 || this._i === -2) {
      return 0;
    }

    return this._i;
  };
};

Promise.disableSynchronous = function() {
  Promise.prototype.isPending = undefined;
  Promise.prototype.isFulfilled = undefined;
  Promise.prototype.isRejected = undefined;
  Promise.prototype.getValue = undefined;
  Promise.prototype.getReason = undefined;
  Promise.prototype.getState = undefined;
};

},{"./core.js":30}],37:[function(require,module,exports){
/**
 * @module  to-array-buffer
 */

var isAudioBuffer = require('is-audio-buffer');
var isUri = require('is-data-uri')
var atob = require('atob-lite')

module.exports = function toArrayBuffer (arg, clone) {
	//zero-length or undefined-like
	if (!arg) return new ArrayBuffer();

	//array buffer
	if (arg instanceof ArrayBuffer) return clone ? arg.slice() : arg;

	//array buffer view: TypedArray, DataView, Buffer etc
	//FIXME: as only Buffer obtains the way to provide subArrayBuffer - use that
	if (ArrayBuffer.isView(arg)) {
		if (arg.byteOffset != null) return arg.buffer.slice(arg.byteOffset, arg.byteOffset + arg.byteLength);
		return clone ? arg.buffer.slice() : arg.buffer;
	}

	//audio-buffer - note that we simply merge data by channels
	//no encoding or cleverness involved
	if (isAudioBuffer(arg)) {
		var floatArray = arg.getChannelData(0).constructor;
		var data = new floatArray(arg.length * arg.numberOfChannels);

		for (var channel = 0; channel < arg.numberOfChannels; channel++) {
			data.set(arg.getChannelData(channel), channel * arg.length);
		}

		return data.buffer;
	}

	//buffer/data nested: NDArray, ImageData etc.
	//FIXME: NDArrays with custom data type may be invalid for this procedure
	if (arg.buffer || arg.data) {
		var result = toArrayBuffer(arg.buffer || arg.data);
		return clone ? result.slice() : result;
	}

	//try to decode data-uri, if any
	if (typeof arg === 'string') {
		//valid data uri
		if (isUri(arg)) {
			var binary = atob(arg.split(',')[1]), array = [];
			for(var i = 0; i < binary.length; i++) array.push(binary.charCodeAt(i));
			return new Uint8Array(array)
		}
		//plain string
		else {
			var buf = new ArrayBuffer(arg.length*2); // 2 bytes for each char
			var bufView = new Uint16Array(buf);
			for (var i=0, strLen=arg.length; i<strLen; i++) {
				bufView[i] = arg.charCodeAt(i);
			}
			return buf
		}
	}

	//array-like or unknown
	//hope Uint8Array knows better how to treat the input
	return (new Uint8Array(arg.length != null ? arg : [arg])).buffer;
}

},{"atob-lite":4,"is-audio-buffer":18,"is-data-uri":21}],38:[function(require,module,exports){

/**
 * @module typedarray-polyfill
 */

var methods = ['values', 'sort', 'some', 'slice', 'reverse', 'reduceRight', 'reduce', 'map', 'keys', 'lastIndexOf', 'join', 'indexOf', 'includes', 'forEach', 'find', 'findIndex', 'copyWithin', 'filter', 'entries', 'every', 'fill'];

if (typeof Int8Array !== 'undefined') {
    for (var i = methods.length; i--;) {
        var method = methods[i];
        if (!Int8Array.prototype[method]) Int8Array.prototype[method] = Array.prototype[method];
    }
}
if (typeof Uint8Array !== 'undefined') {
    for (var i = methods.length; i--;) {
        var method = methods[i];
        if (!Uint8Array.prototype[method]) Uint8Array.prototype[method] = Array.prototype[method];
    }
}
if (typeof Uint8ClampedArray !== 'undefined') {
    for (var i = methods.length; i--;) {
        var method = methods[i];
        if (!Uint8ClampedArray.prototype[method]) Uint8ClampedArray.prototype[method] = Array.prototype[method];
    }
}
if (typeof Int16Array !== 'undefined') {
    for (var i = methods.length; i--;) {
        var method = methods[i];
        if (!Int16Array.prototype[method]) Int16Array.prototype[method] = Array.prototype[method];
    }
}
if (typeof Uint16Array !== 'undefined') {
    for (var i = methods.length; i--;) {
        var method = methods[i];
        if (!Uint16Array.prototype[method]) Uint16Array.prototype[method] = Array.prototype[method];
    }
}
if (typeof Int32Array !== 'undefined') {
    for (var i = methods.length; i--;) {
        var method = methods[i];
        if (!Int32Array.prototype[method]) Int32Array.prototype[method] = Array.prototype[method];
    }
}
if (typeof Uint32Array !== 'undefined') {
    for (var i = methods.length; i--;) {
        var method = methods[i];
        if (!Uint32Array.prototype[method]) Uint32Array.prototype[method] = Array.prototype[method];
    }
}
if (typeof Float32Array !== 'undefined') {
    for (var i = methods.length; i--;) {
        var method = methods[i];
        if (!Float32Array.prototype[method]) Float32Array.prototype[method] = Array.prototype[method];
    }
}
if (typeof Float64Array !== 'undefined') {
    for (var i = methods.length; i--;) {
        var method = methods[i];
        if (!Float64Array.prototype[method]) Float64Array.prototype[method] = Array.prototype[method];
    }
}
if (typeof TypedArray !== 'undefined') {
    for (var i = methods.length; i--;) {
        var method = methods[i];
        if (!TypedArray.prototype[method]) TypedArray.prototype[method] = Array.prototype[method];
    }
}
},{}],39:[function(require,module,exports){
'use strict';

/**
* FUNCTION: isArray( value )
*	Validates if a value is an array.
*
* @param {*} value - value to be validated
* @returns {Boolean} boolean indicating whether value is an array
*/
function isArray( value ) {
	return Object.prototype.toString.call( value ) === '[object Array]';
} // end FUNCTION isArray()

// EXPORTS //

module.exports = Array.isArray || isArray;

},{}],40:[function(require,module,exports){
/**
*
*	VALIDATE: function
*
*
*	DESCRIPTION:
*		- Validates if a value is a function.
*
*
*	NOTES:
*		[1]
*
*
*	TODO:
*		[1]
*
*
*	LICENSE:
*		MIT
*
*	Copyright (c) 2014. Athan Reines.
*
*
*	AUTHOR:
*		Athan Reines. kgryte@gmail.com. 2014.
*
*/

'use strict';

/**
* FUNCTION: isFunction( value )
*	Validates if a value is a function.
*
* @param {*} value - value to be validated
* @returns {Boolean} boolean indicating whether value is a function
*/
function isFunction( value ) {
	return ( typeof value === 'function' );
} // end FUNCTION isFunction()


// EXPORTS //

module.exports = isFunction;

},{}],41:[function(require,module,exports){
/**
*
*	VALIDATE: integer-array
*
*
*	DESCRIPTION:
*		- Validates if a value is an integer array.
*
*
*	NOTES:
*		[1]
*
*
*	TODO:
*		[1]
*
*
*	LICENSE:
*		MIT
*
*	Copyright (c) 2015. Athan Reines.
*
*
*	AUTHOR:
*		Athan Reines. kgryte@gmail.com. 2015.
*
*/

'use strict';

// MODULES //

var isArray = require( 'validate.io-array' ),
	isInteger = require( 'validate.io-integer' );


// IS INTEGER ARRAY //

/**
* FUNCTION: isIntegerArray( value )
*	Validates if a value is an integer array.
*
* @param {*} value - value to be validated
* @returns {Boolean} boolean indicating if a value is an integer array
*/
function isIntegerArray( value ) {
	var len;
	if ( !isArray( value ) ) {
		return false;
	}
	len = value.length;
	if ( !len ) {
		return false;
	}
	for ( var i = 0; i < len; i++ ) {
		if ( !isInteger( value[i] ) ) {
			return false;
		}
	}
	return true;
} // end FUNCTION isIntegerArray()


// EXPORTS //

module.exports = isIntegerArray;

},{"validate.io-array":39,"validate.io-integer":42}],42:[function(require,module,exports){
/**
*
*	VALIDATE: integer
*
*
*	DESCRIPTION:
*		- Validates if a value is an integer.
*
*
*	NOTES:
*		[1]
*
*
*	TODO:
*		[1]
*
*
*	LICENSE:
*		MIT
*
*	Copyright (c) 2014. Athan Reines.
*
*
*	AUTHOR:
*		Athan Reines. kgryte@gmail.com. 2014.
*
*/

'use strict';

// MODULES //

var isNumber = require( 'validate.io-number' );


// ISINTEGER //

/**
* FUNCTION: isInteger( value )
*	Validates if a value is an integer.
*
* @param {Number} value - value to be validated
* @returns {Boolean} boolean indicating whether value is an integer
*/
function isInteger( value ) {
	return isNumber( value ) && value%1 === 0;
} // end FUNCTION isInteger()


// EXPORTS //

module.exports = isInteger;

},{"validate.io-number":43}],43:[function(require,module,exports){
/**
*
*	VALIDATE: number
*
*
*	DESCRIPTION:
*		- Validates if a value is a number.
*
*
*	NOTES:
*		[1]
*
*
*	TODO:
*		[1]
*
*
*	LICENSE:
*		MIT
*
*	Copyright (c) 2014. Athan Reines.
*
*
*	AUTHOR:
*		Athan Reines. kgryte@gmail.com. 2014.
*
*/

'use strict';

/**
* FUNCTION: isNumber( value )
*	Validates if a value is a number.
*
* @param {*} value - value to be validated
* @returns {Boolean} boolean indicating whether value is a number
*/
function isNumber( value ) {
	return ( typeof value === 'number' || Object.prototype.toString.call( value ) === '[object Number]' ) && value.valueOf() === value.valueOf();
} // end FUNCTION isNumber()


// EXPORTS //

module.exports = isNumber;

},{}],44:[function(require,module,exports){
/**
 * @module  web-audio-stream/writable
 *
 * Write stream data to web-audio.
 */
'use strict';


var inherits = require('inherits');
var Writable = require('stream').Writable;
var createWriter = require('./write');

module.exports = WAAWritable;


/**
 * @constructor
 */
function WAAWritable (node, options) {
	if (!(this instanceof WAAWritable)) return new WAAWritable(node, options);

	let write = createWriter(node, options);

	Writable.call(this, {
		//we need object mode to recognize any type of input
		objectMode: true,

		//to keep processing delays very short, in case of RT binding.
		//otherwise each stream will hoard data and release only when it’s full.
		highWaterMark: 0,

		write: (chunk, enc, cb) => {
			return write(chunk, cb);
		}
	});


	//manage input pipes number
	this.inputsCount = 0;
	this.on('pipe', (source) => {
		this.inputsCount++;

		//do autoend
		source.once('end', () => {
			this.end()
		});

	}).on('unpipe', (source) => {
		this.inputsCount--;
	})

	//end writer
	this.once('end', () => {
		write.end()
	})
}


inherits(WAAWritable, Writable);


/**
 * Rendering modes
 */
WAAWritable.WORKER_MODE = 2;
WAAWritable.SCRIPT_MODE = 1;
WAAWritable.BUFFER_MODE = 0;


/**
 * There is an opinion that script mode is better.
 * https://github.com/brion/audio-feeder/issues/13
 *
 * But for me there are moments of glitch when it infinitely cycles sound. Very disappointing and makes feel desperate.
 *
 * But buffer mode also tend to create noisy clicks. Not sure why, cannot remove that.
 * With script mode I at least defer my responsibility.
 */
WAAWritable.prototype.mode = WAAWritable.SCRIPT_MODE;


/** Count of inputs */
WAAWritable.prototype.inputsCount = 0;


/**
 * Overrides stream’s end to ensure event.
 */
//FIXME: not sure why `end` is triggered here like 10 times.
WAAWritable.prototype.end = function () {
	if (this.isEnded) return;

	this.isEnded = true;

	var triggered = false;
	this.once('end', () => {
		triggered = true;
	});
	Writable.prototype.end.call(this);

	//timeout cb, because native end emits after a tick
	setTimeout(() => {
		if (!triggered) {
			this.emit('end');
		}
	});

	return this;
};

},{"./write":45,"inherits":17,"stream":221}],45:[function(require,module,exports){
/**
 * @module  web-audio-stream/write
 *
 * Write data to web-audio.
 */
'use strict';


const extend = require('object-assign')
const pcm = require('pcm-util')
const util = require('audio-buffer-utils')
const isAudioBuffer = require('is-audio-buffer')
const AudioBufferList = require('audio-buffer-list')

module.exports = WAAWriter;


/**
 * Rendering modes
 */
WAAWriter.WORKER_MODE = 2;
WAAWriter.SCRIPT_MODE = 1;
WAAWriter.BUFFER_MODE = 0;


/**
 * @constructor
 */
function WAAWriter (target, options) {
	if (!target || !target.context) throw Error('Pass AudioNode instance first argument')

	if (!options) {
		options = {};
	}

	options.context = target.context;

	options = extend({
		/**
		 * There is an opinion that script mode is better.
		 * https://github.com/brion/audio-feeder/issues/13
		 *
		 * But for me there are moments of glitch when it infinitely cycles sound. Very disappointing and makes feel desperate.
		 *
		 * But buffer mode also tend to create noisy clicks. Not sure why, cannot remove that.
		 * With script mode I at least defer my responsibility.
		 */
		mode: WAAWriter.SCRIPT_MODE,
		samplesPerFrame: pcm.defaults.samplesPerFrame,

		//FIXME: take this from input node
		channels: pcm.defaults.channels
	}, options)

	//ensure input format
	let format = pcm.format(options)
	pcm.normalize(format)

	let context = options.context;
	let channels = options.channels;
	let samplesPerFrame = options.samplesPerFrame;
	let sampleRate = context.sampleRate;
	let node, release, isStopped, isEmpty = false;

	//queued data to send to output
	let data = new AudioBufferList(0, channels)

	//init proper mode
	if (options.mode === WAAWriter.SCRIPT_MODE) {
		node = initScriptMode()
	}
	else if (options.mode === WAAWriter.BUFFER_MODE) {
		node = initBufferMode()
	}
	else {
		throw Error('Unknown mode. Choose from BUFFER_MODE or SCRIPT_MODE')
	}

	//connect node
	node.connect(target)

	write.end = () => {
		if (isStopped) return;
		node.disconnect()
		isStopped = true;
	}

	return write;

	//return writer function
	function write (buffer, cb) {
		if (isStopped) return;

		if (buffer == null) {
			return write.end()
		}
		else {
			push(buffer)
		}
		release = cb;
	}


	//push new data for the next WAA dinner
	function push (chunk) {
		if (!isAudioBuffer(chunk)) {
			chunk = util.create(chunk, channels)
		}

		data.append(chunk)

		isEmpty = false;
	}

	//get last ready data
	function shift (size) {
		size = size || samplesPerFrame;

		//if still empty - return existing buffer
		if (isEmpty) return data;

		let output = data.slice(0, size)

		data.consume(size)

		//if size is too small, fill with silence
		if (output.length < size) {
			output = util.pad(output, size)
		}

		return output;
	}

	/**
	 * Init scriptProcessor-based rendering.
	 * Each audioprocess event triggers tick, which releases pipe
	 */
	function initScriptMode () {
		//buffer source node
		let bufferNode = context.createBufferSource()
		bufferNode.loop = true;
		bufferNode.buffer = util.create(samplesPerFrame, channels, {context: context})

		node = context.createScriptProcessor(samplesPerFrame)
		node.addEventListener('audioprocess', function (e) {
			//release causes synchronous pulling the pipeline
			//so that we get a new data chunk
			let cb = release;
			release = null;
			cb && cb()

			if (isStopped) return;

			util.copy(shift(e.inputBuffer.length), e.outputBuffer)
		})

		//start should be done after the connection, or there is a chance it won’t
		bufferNode.connect(node)
		bufferNode.start()

		return node;
	}


	/**
	 * Buffer-based rendering.
	 * The schedule is triggered by setTimeout.
	 */
	function initBufferMode () {
		//how many times output buffer contains input one
		let FOLD = 2;

		//buffer source node
		node = context.createBufferSource()
		node.loop = true;
		node.buffer = util.create(samplesPerFrame * FOLD, channels, {context: node.context})

		//output buffer
		let buffer = node.buffer;

		//audio buffer realtime ticked cycle
		//FIXME: find a way to receive target starving callback here instead of unguaranteed timeouts
		setTimeout(tick)

		node.start()

		//last played count, position from which there is no data filled up
		let lastCount = 0;

		//time of start
		//FIXME: find out why and how this magic coefficient affects buffer scheduling
		let initTime = context.currentTime;

		return node;

		//tick function - if the half-buffer is passed - emit the tick event, which will fill the buffer
		function tick (a) {
			if (isStopped) return;

			let playedTime = context.currentTime - initTime;
			let playedCount = playedTime * sampleRate;

			//if offset has changed - notify processor to provide a new piece of data
			if (lastCount - playedCount < samplesPerFrame) {
				//send queued data chunk to buffer
				util.copy(shift(samplesPerFrame), buffer, lastCount % buffer.length)

				//increase rendered count
				lastCount += samplesPerFrame;

				//if there is a holding pressure control - release it
				if (release) {
					let cb = release;
					release = null;
					cb()
				}

				//call tick extra-time in case if there is a room for buffer
				//it will plan timeout, if none
				tick()
			}
			//else plan tick for the expected time of starving
			else {
				//time of starving is when played time reaches (last count time) - half-duration
				let starvingTime = (lastCount - samplesPerFrame) / sampleRate;
				let remainingTime = starvingTime - playedTime;
				setTimeout(tick, remainingTime * 1000)
			}
		}
	}
}

},{"audio-buffer-list":5,"audio-buffer-utils":7,"is-audio-buffer":18,"object-assign":26,"pcm-util":27}],46:[function(require,module,exports){
const config = require("./config.js")

class CircleBuffer {
  constructor(numberOfChannels, lengthInSeconds) {
    this.numberOfChannels = numberOfChannels || 1
    this.lengthInSeconds = lengthInSeconds
    this.sampleRate = config.sampleRate
    this.lengthInSamples = Math.ceil(this.lengthInSeconds*this.sampleRate)

    this.channelData = []
    for(var c=0; c<this.numberOfChannels; c++)
      this.channelData[c] = new Float32Array(this.lengthInSamples)
  }

  read(c, t) {
    t = Math.floor(t%this.lengthInSamples)
    while(t < 0)
      t += this.lengthInSamples
    return this.channelData[c][t]
  }
  write(c, t, y) {
    t = Math.floor(t%this.lengthInSamples)
    while(t < 0)
      t += this.lengthInSamples

    this.channelData[c][t] = y
  }
  mix(c, t, y) {
    t = Math.floor(t%this.lengthInSamples)
    while(t < 0)
      t += this.lengthInSamples

    this.channelData[c][t] += y
  }
}
module.exports = CircleBuffer

},{"./config.js":122}],47:[function(require,module,exports){
const gcd = require("compute-gcd")
const Promise = require("promise")

function Circuit() {
  this.units = []
  this.vital = [] // a list of units which are needed
  this.tickIntervals = []
  this.clock = 0
  this.events = []
  this.promises = []

  this.keepTicking = false

  for(var i in arguments)
    this.add(arguments[i])
}
module.exports = Circuit

Circuit.prototype.tick = async function() {

  //console.log("promises:", this.promises)

  this.runEvents(this.clock + this.gcdTickInterval)

  if(this.promises.length > 0) {
    console.log("waiting for", this.promises.length, "promises")
    var cake = await Promise.all(this.promises)
    console.log("promises fulfilled!")
    this.promises = []
  }

  this.midcycle = true

  for(var i=0; i<this.units.length; i++) {
    if(this.clock%this.units[i].tickInterval == 0)
      this.units[i].tick(this.clock)
  }

  this.clock += this.gcdTickInterval
  this.midcycle = false
}
Circuit.prototype.tickUntil = async function(t) {
  while(this.clock < t) {
    await this.tick()
  //  console.log("baah")
  }
}
Circuit.prototype.startTicking = async function() {
  this.keepTicking = true
  while(this.keepTicking)
    await this.tick()
}
Circuit.prototype.stopTicking = function() {
  this.keepTicking = false
}

Circuit.prototype.runEvents = function(beforeT) {
  beforeT = beforeT || this.clock
  var followUps = []
  while(this.events[0] && this.events[0].t < beforeT) {
    var followUpEvent = this.events.shift().run()
    if(followUpEvent)
      this.addEvent(followUpEvent)
  }
}

Circuit.prototype.add = function(unit) {
  if(unit.circuit && unit.circuit != this)
    throw "circuit clash, oh god " + unit.label + "\n"+(unit.circuit == this)
  if(this.units.indexOf(unit) != -1)
    return null;

  //console.log("adding", unit.label, "to circuit\t", unit.promises)

  this.units.push(unit)
  unit.circuit = this
  if(this.tickIntervals.indexOf(unit.tickInterval) == -1) {
    this.tickIntervals.push(unit.tickInterval)
    this.tickIntervals = this.tickIntervals.sort((a,b) => {return a-b})
  }

  // events
  if(unit.events) {
    for(var i in unit.events)
      this.addEvent(unit.events[i])
    unit.events = null  // from now on events will be redirected to the circuit
  }
  // promises
  if(unit.promises) {
    for(var i in unit.promises)
      this.addPromise(unit.promises[i])
    unit.promises = null
    // from now on promises will be redirected to the circuit
  }

  var inputUnits = unit.inputUnits
  for(var i in inputUnits)
    this.add(inputUnits[i])
  var outputUnits = unit.outputUnits
  for(var i in outputUnits)
    this.add(outputUnits[i])

  unit.computeProcessIndex()
  this.computeOrders()

  return true
}

Circuit.prototype.addEvent = function(eventToAdd) {
  eventToAdd.circuit = this
  for(var i=0; i<this.events.length; i++) {
    if(eventToAdd.t < this.events[i].t) {
      this.events.splice(i, 0, eventToAdd)
      return ;
    }
  }

  // if we get here the new event must be after all others
  this.events.push(eventToAdd)
}
Circuit.prototype.addPromise = function(promise) {
  this.promises.push(promise)
}

Circuit.prototype.computeOrders = function() {
  this.units = this.units.sort((a, b) => {
  //  console.log(a.processIndex, b.processIndex)
    return a.processIndex - b.processIndex
  })
  this.processOrders = {}
  for(var i in this.tickIntervals) {
    var tickInterval = this.tickIntervals[i]
    this.processOrders[tickInterval] = this.units.filter((unit) => {
      return tickInterval%unit.tickInterval == 0
    })
  }
  this.gcdTickInterval = this.tickIntervals[0]
  for(var i=1; i<this.tickIntervals.length; i++) {
    this.gcdTickInterval = gcd(this.gcdTickInterval, this.tickIntervals[i])
  }
  if(this.gcdTickInterval <= 16)
    console.warn("circuit gcdTickInterval is low:", this.gcdTickInterval, ", processing may be slow")

}

Circuit.prototype.findNaNCulprit = function() {
  for(var i in this.units) {
    for(var j in this.units[i].inlets) {
      var inlet = this.units[i].inlets[j]
      var chunk = inlet.signalChunk.channelData
      for(var c in chunk)
        for(var t in chunk[c])
          if(isNaN(chunk[c][t]))
            return inlet
    }
    for(var j in this.units[i].outlets) {
      var outlet = this.units[i].outlets[j]
      var chunk = outlet.signalChunk.channelData
      for(var c in chunk)
        for(var t in chunk[c])
          if(isNaN(chunk[c][t]))
            return outlet
    }
  }
}

Circuit.prototype.__defineGetter__("print", function() {
  this.printAsArray.join("\n")
})
Circuit.prototype.__defineGetter__("printAsArray", function() {
  var units = []
  for(var i=0; i<this.units.length; i++)
    units[i] = this.units[i].print
  return units
  /*return this.units.map((unit) => {
    return unit.print
  })*/
})

Circuit.prototype.__defineGetter__("lastUnit", function() {
  return this.units[this.units.length-1]
})
Circuit.prototype.findUnit = function(label) {
  for(var i in this.units) {
    if(units[i].label = label)
      return units[i]
  }
  return null
}

Circuit.prototype.unconnectedInlets = function(matching) {
  matching = matching || {}
  var list = []
  for(var i in this.units) {
    for(var name in this.units[i].inlets) {
      var inlet = this.units[i].inlets[name]
      if(inlet.connected)
        continue
      var aMatch = true
      for(var prop in matching)
        if(matching[prop] != inlet[prop]){
          aMatch = false
          break
        }
      if(aMatch)
        list.push(inlet)
    }
  }
  return list
}

Circuit.prototype.randomInlet = function() {
  var unit = this.units[Math.floor(Math.random() * this.units.length)]
  return unit.randomInlet()
}
Circuit.prototype.randomOutlet = function() {
  var unit = this.units[Math.floor(Math.random() * this.units.length)]
  return unit.randomOutlet()
}

},{"compute-gcd":13,"promise":29}],48:[function(require,module,exports){
const config = require("./config")

function Event(time, f, unit, circuit) {
  this.time = time// perhaps as a general rule, t is in samples but time is in seconds
  this.function = f
  this.unit = unit
  this.circuit = circuit
}
module.exports = Event

Event.prototype.__defineGetter__("time", function() {
  return this.t / config.sampleRate
})
Event.prototype.__defineSetter__("time", function(time) {
  this.t = time * config.sampleRate
})

Event.prototype.run = function() {
  var subject = this.unit || this.circuit || null
  var returnValue = this.function.call(subject)
  if(returnValue > 0)
    return new Event(
      this.time + returnValue,
      this.function,
      this.unit,
      this.circuit,
    )
  else
    return null
}

},{"./config":122}],49:[function(require,module,exports){
const Piglet = require("./Piglet.js")
const SignalChunk = require("./SignalChunk.js")

function Inlet(model) {
  Piglet.call(this, model)

  this.outlet = null
  this.constant = 0
}
Inlet.prototype = Object.create(Piglet.prototype)
Inlet.prototype.constructor = Inlet
module.exports = Inlet

Inlet.prototype.isInlet = true

Inlet.prototype.disconnect = function() {
  if(this.outlet) {
    this.outlet.connections.splice(this.outlet.connections.indexOf(this), 1)
    this.outlet = null
    this.signalChunk = new SignalChunk(this.numberOfChannels, this.chunkSize)
    this.exposeDataToUnit()
    this.connected = false
  }
}

Inlet.prototype.set = function(val) {
  if(val && val.isUnit || val.isOutlet || val.isPatch)
    this.connect(val)
  else
    this.setConstant(val)
}

Inlet.prototype.get = function() {
  if(this.connected)
    return this.outlet
  else
    return this.constant
}

Inlet.prototype.connect = function(outlet) {
  if(outlet == undefined)
    console.warn('WARNING: connecting', this.label, "to undefined")
  if(outlet.isUnit || outlet.isPatch)
    outlet = outlet.defaultOutlet
  if(this.connected)
    this.disconnect()
  this.connected = true

  if(this.chunkSize != outlet.chunkSize)
    console.warn("Inlet/Outlet chunkSize mismatch!", outlet.label, "->", this.label)

  this.outlet = outlet
  outlet.connections.push(this)
  this.signalChunk = outlet.signalChunk
  this.exposeDataToUnit()

  if(this.unit.circuit && outlet.unit.circuit && this.unit.circuit != outlet.unit.circuit)
    throw "SHIT: Circuit conflict"

  var modifiedCircuit = null
  if(this.unit.circuit) {
    this.unit.circuit.add(outlet.unit)
    modifiedCircuit = this.unit.circuit
  } else if(outlet.unit.circuit) {
    outlet.unit.circuit.add(this.unit)
    modifiedCircuit = outlet.unit.circuit
  }

  if(modifiedCircuit) {
    this.unit.computeProcessIndex()
    outlet.unit.computeProcessIndex()
    modifiedCircuit.computeOrders()
  }
}

Inlet.prototype.setConstant = function(value) {
  if(this.outlet)
    this.disconnect()

  this.constant = value

  if(value.constructor != Array)
    value = [value]

  var chunk = this.signalChunk
  for(var c=0; c<chunk.channelData.length || c<value.length; c++) {
    var chanVal = value[c%value.length]
    chunk.channelData[c] = chunk.channelData[c] || new Float32Array(this.chunkSize)
    var chan = chunk.channelData[c]
    for(var t=0; t<chan.length; t++)
      chan[t] = chanVal
  }
}

Inlet.prototype.__defineGetter__("printValue", function() {
  if(this.outlet)
    return this.outlet.label
  else return this.constant
})

},{"./Piglet.js":52,"./SignalChunk.js":54}],50:[function(require,module,exports){
const Piglet = require("./Piglet.js")
//const render = require("./render.js")

function Outlet(model) {
  Piglet.call(this, model)

  this.connections = []
}
Outlet.prototype = Object.create(Piglet.prototype)
Outlet.prototype.constructor = Outlet
module.exports = Outlet

Outlet.prototype.isOutlet = true

/*Outlet.prototype.render = async function(T) {
  return render(this, T)
}*/

Outlet.prototype.disconnect = function() {
  for(var i in this.connections)
    this.connections[i].disconnect()
}

},{"./Piglet.js":52}],51:[function(require,module,exports){
// A class for the quick construction and connection of complex dsp structures
// A Patch is an object for overseeing the construction of a circuit or part of a circuit
const UnitOrPatch = require("./UnitOrPatch.js")
const Event = require("./Event.js")

function Patch() {
  UnitOrPatch.call(this)

  this.inlets = {}
  this.outlets = {}
  this.inletsOrdered = []
  this.outletsOrdered = []
  this.units = []

  this.constructor.timesUsed = (this.constructor.timesUsed || 0) + 1
  this.label = this.constructor.name + this.constructor.timesUsed
}
Patch.prototype = Object.create(UnitOrPatch.prototype)
Patch.prototype.constructor = Patch
module.exports = Patch

Patch.prototype.isPatch = true

Patch.prototype.aliasInlet = function(inlet, name) {
  if(inlet.isUnit || inlet.isPatch)
    inlet = inlet.inletsOrdered[0]
  if(name == undefined) {
    name = inlet.name
    var n = 0
    while(this.inlets[name]) {
      n++
      name = inlet.name + n
    }
  }
  this.inlets[name] = inlet
  this.inletsOrdered.push(inlet)
  this.__defineGetter__(name.toUpperCase(), function() {
    return inlet.unit[inlet.name.toUpperCase()]
  })
  this.__defineSetter__(name.toUpperCase(), function(val) {
    inlet.unit[inlet.name.toUpperCase()] = val
  })
}
Patch.prototype.aliasOutlet = function(outlet, name) {
  if(outlet.isUnit || outlet.isPatch)
    outlet = outlet.defaultOutlet
  if(name == undefined) {
    name = outlet.name
    var n = 0
    while(this.outlets[name]) {
      n++
      name = outlet.name + n
    }
  }
  this.outlets[name] = outlet
  this.outletsOrdered.push(outlet)
  this.__defineGetter__(name.toUpperCase(), function() {
    return outlet.unit[outlet.name.toUpperCase()]
  })
  this.__defineSetter__(name.toUpperCase(), function(val) {
    outlet.unit[outlet.name.toUpperCase()] = val
  })
}
Patch.prototype.alias = function(piglet, name) {
  if(piglet.isInlet)
    this.aliasInlet(piglet, name)
  else if(piglet.isOutlet)
    this.aliasOutlet(piglet, name)
}

Patch.prototype.__defineGetter__("defaultInlet", function() {
  return this.inletsOrdered[0]
})
Patch.prototype.__defineGetter__("defaultOutlet", function() {
  return this.outletsOrdered[0]
})

Patch.prototype.addUnit = function(unit) {
  if(unit.isUnit) {
    this.units.push(unit)
    unit.ownerPatch = this
  } else if(unit.isPatch) {
    this.units.push(unit)
    unit.ownerPatch = this
  }
}

Patch.prototype.addUnits = function() {
  for(var i in arguments) {
    if(arguments[i].constructor == Array)
      for(var j in arguments[i])
        this.addUnit(arguments[i][j])
    else
      this.addUnit(arguments[i])
  }
}



Patch.prototype.addEvent = function(newEvent) {
  if(this.units[0])
    this.units[0].addEvent(newEvent)
  else
    throw "Could not add event as Patch posseses no units: " + this.label
}

Patch.prototype.addPromise = function(promise) {
  if(this.units[0])
    this.units[0].addPromise(promise)
  else
    throw "Could not add promise as Patch posseses no units: " + this.label
}

Patch.prototype.trigger = function() {
  for(var i in this.units)
    if(this.units[i].trigger)
      this.units[i].trigger()
  return this
}

},{"./Event.js":48,"./UnitOrPatch.js":56}],52:[function(require,module,exports){
// Class from which Outlet and Inlet inherit from so that they can share code
const config = require("./config.js")
const SignalChunk = require("./SignalChunk.js")

function Piglet(model) {
  if(model)
    Object.assign(this, model)

  this.numberOfChannels = this.numberOfChannels || 1
  this.chunkSize = model.chunkSize || config.standardChunkSize
  this.sampleRate = config.sampleRate

  if(this.numberOfChannels == "mono" || model.mono) {
    this.numberOfChannels = 1
    this.exposeAsMono = true
  } else
    this.exposeAsMono = false

  // simple rules
  this.applyTypeRules()

  this.signalChunk = new SignalChunk(this.numberOfChannels, this.chunkSize)
}
module.exports = Piglet

Piglet.prototype.isPiglet = true

Piglet.prototype.applyTypeRules = function() {
  if(this.measuredIn == "seconds")
    this.measuredIn = "s"
  if(this.measuredIn == "s")
    this.type = "time"
  if(this.measuredIn == "samples")
    this.type = "time"

  if(this.measuredIn == "dB")
    this.type = "gain"

  if(this.measuredIn == "Hz")
    this.type = "frequency"

  if(this.type == "audio") {
    this.min = -1
    this.max = 1
  }

  if(this.type == "spectral") {
    this.complex = true
    this.real = false
  }

  if(this.type == "midi")
    this.measuredIn = "semitones"
}

Piglet.prototype.exposeDataToUnit = function() {
  if(this.exposeAsMono)
    this.unit[this.name] = this.signalChunk.channelData[0]
  else
    this.unit[this.name] = this.signalChunk.channelData
}

Piglet.prototype.__defineGetter__("label", function() {
  return this.unit.label + "." + this.name.toUpperCase()
})

Piglet.prototype.__defineGetter__("circuit", function() {
  return this.unit.circuit
})

},{"./SignalChunk.js":54,"./config.js":122}],53:[function(require,module,exports){
const {Readable} = require("stream")
const AudioBuffer = require('audio-buffer')

const floatToIntScaler = Math.pow(2, 30)

class RenderStream extends Readable {
  constructor(outlet, numberOfChannels=1, timeout) {
    super({objectMode:true})
    if(!outlet)
      throw "RenderStream requires an outlet argument"
    if(outlet.isUnitOrPatch)
      outlet = outlet.defaultOutlet

    if(!outlet.isOutlet)
      throw "RenderStream expects an outlet"

    this.numberOfChannels = numberOfChannels
    this.outlet = outlet
    this.circuit = outlet.unit.getOrBuildCircuit()
    this.sampleRate = outlet.sampleRate

    this.normaliseFactor = 1

    this.tickClock = 0

    this.outlet.onTick = () => {
      // create a buffer for this chunk
      var buffer = new Float32Array(this.numberOfChannels * this.outlet.chunkSize)
      /*new AudioBuffer(null, {
        length:this.outlet.chunkSize,
        sampleRate: this.outlet.sampleRate,
        numberOfChannels: this.outlet.numberOfChannels
      })*/

      // loop through outlet SignalChunk
      for(var c=0; c<this.numberOfChannels; c++)
        for(var t=0; t<this.outlet.chunkSize; t++) {
          // rescale samples to normalise (according to peak so far)
          var val = this.outlet.signalChunk.channelData[c][t] * this.normaliseFactor

          // if signal is outside of ideal range adjust the normalisation scalar
          if(Math.abs(val) > 1) {
            var sf = Math.abs(1/val)
            val *= sf
            this.normaliseFactor *= sf
            console.warn("Digital clipping, autonormalised", this.normaliseFactor)
          }

          // throw an error is sample is NaN
          if(isNaN(val))
            throw "can't record NaN"

          // write sample to the buffer
          buffer [t*this.numberOfChannels+c] = (val)
        }

      // send to stream, pause processing if internal buffer is full
      if(!this.push(buffer)) {
        this.circuit.stopTicking()
      }
    }

    this.format = {
      channels: this.numberOfChannels,
      bitDepth: 32,
      sampleRate: this.sampleRate,
      endianness: "LE",
    }
    console.log(this.format)
  }

  _read() {
    this.circuit.startTicking()
  }

  stop() {
    this.push(null)
    //this.end()
  }
}
module.exports = RenderStream

},{"audio-buffer":9,"stream":221}],54:[function(require,module,exports){
function SignalChunk(numberOfChannels, chunkSize) {
  this.numberOfChannels = numberOfChannels
  this.chunkSize = chunkSize

  this.channelData = []
  for(var c=0; c<numberOfChannels; c++) {
    this.channelData[c] = new Float32Array(chunkSize)
  }

  this.owner = null
}
module.exports = SignalChunk

SignalChunk.prototype.duplicateChannelData = function() {
  var data = []
  for(var i in this.channelData) {
    data[i] = this.channelData[i].slice()
  }
  return data
}

},{}],55:[function(require,module,exports){
const UnitOrPatch = require("./UnitOrPatch.js")
const config = require("./config.js")
const Outlet = require("./Outlet.js")
const Inlet = require("./Inlet.js")
const Circuit = require("./Circuit")

function Unit() {
  UnitOrPatch.call(this)

  this.inlets = {}
  this.inletsOrdered = []
  this.outlets = {}
  this.outletsOrdered = []

  this.events = []
  this.promises = []

  this.clock = 0
  this.tickInterval = Unit.standardChunkSize

  this.finished = false

  this.nChains = 0
  this.afterChains = []
  this.beforeChains = []

  this.constructor.timesUsed = (this.constructor.timesUsed || 0) + 1
  this.giveUniqueLabel()
}
Unit.prototype = Object.create(UnitOrPatch.prototype)
Unit.prototype.constructor = Unit
module.exports = Unit

Unit.sampleRate = config.sampleRate
Unit.samplePeriod = 1/config.sampleRate
Unit.standardChunkSize = config.standardChunkSize

Unit.prototype.isUnit = true
Unit.prototype.sampleRate = config.sampleRate
Unit.prototype.samplePeriod = 1/config.sampleRate

Unit.prototype.giveUniqueLabel = function() {
  if(!this.label)
    this.label = this.constructor.name + this.constructor.timesUsed
  return this.label
}

Unit.prototype.addInlet = function(name, options) {
  options = options || {}
  options.name = name
  options.unit = this

  var inlet = new Inlet(options)
  this.inlets[name] = inlet
  this.inletsOrdered.push(inlet)
  this.__defineGetter__(name.toUpperCase(), function() {
    return inlet
  })
  this.__defineSetter__(name.toUpperCase(), function(val) {
    if(val == undefined)
      throw "Passed bad value to " + inlet.label

    if(val.constructor == Number || val.constructor == Array)
      inlet.setConstant(val)
    if(val.isOutlet || val.isUnit || val.isPatch)
      inlet.connect(val)
  })

  inlet.exposeDataToUnit()

  return inlet
}
Unit.prototype.addOutlet = function(name, options) {
  options = options || {}
  options.name = name
  options.unit = this
  var outlet = new Outlet(options)

  outlet.exposeDataToUnit()

  this.outlets[name] = outlet
  this[name.toUpperCase()] = outlet
  this.outletsOrdered.push(outlet)

  return outlet
}

Unit.prototype.chainAfter = function(unit) {
  if(!unit.isUnit)
    throw "chainAfter expects a Unit"
  this.addInlet(
    "chain"+(this.nChains++),
    {noData:true})
  .connect(
    unit.addOutlet("chain"+(unit.nChains++)),
    {noData: true}
  )
}
Unit.prototype.chain = Unit.prototype.chainAfter

Unit.prototype.chainBefore = function(unit) {
  if(!unit.isUnit)
    throw "chainBefore expects a Unit"
  return unit.chainAfter(this)
}
Unit.prototype.unChain = function(objectToUnchain) {
  // to do
  console.warn("TODO: Unit.prototype.unchain()")
}

Unit.prototype.tick = function(clock0) {
  this.clock = clock0
  if(this._tick)
    this._tick(clock0)
  this.clock = clock0 + this.tickInterval
  for(var i in this.outlets) // used for renderStream
    if(this.outlets[i].onTick)
      this.outlets[i].onTick()
}

Unit.prototype.__defineGetter__("inputUnits", function() {
  var list = []
  for(var i in this.inlets) {
    if(!this.inlets[i].connected)
      continue

    var unit = this.inlets[i].outlet.unit
    if(list.indexOf(unit) == -1)
      list.push(unit)
  }
  return list
})
Unit.prototype.__defineGetter__("outputUnits", function() {
  var list = []
  for(var i in this.outlets) {
    for(var j in this.outlets[i].connections) {
      var unit = this.outlets[i].connections[j].unit
      if(list.indexOf(unit) == -1)
        list.push(unit)
    }
  }
  return list
})
Unit.prototype.__defineGetter__("numberOfOutgoingConnections", function() {
  var n = 0
  for(var name in this.outlets)
    n += this.outlets[name].connections
  return n
})
Unit.prototype.__defineGetter__("neighbours", function() {
  var inputs = this.inputUnits
  var outputs = this.outputUnits
    .filter(item => (inputs.indexOf(item) == -1))
  return inputs.concat(outputs)
})

Unit.prototype.randomInlet = function() {
  return this.inletsOrdered[Math.floor(Math.random()*this.inletsOrdered.length)]
}
Unit.prototype.randomOutlet = function() {
  return this.outletsOrdered[Math.floor(Math.random()*this.outletsOrdered.length)]
}

Unit.prototype.__defineGetter__("printInputUnits", function() {
  return this.inputUnits.map((unit)=>{return unit.label}).join(", ")
})
Unit.prototype.__defineGetter__("printOutputUnits", function() {
  return this.outputUnits.map((unit) =>{return unit.label}).join(", ")
})

Unit.prototype.computeProcessIndex = function(history) {
  history = (history || []).concat([this])

  var inputUnits = this.inputUnits.filter((unit) => {
    return (history.indexOf(unit) == -1)
  })

  var max = -1
  for(var i in inputUnits) {
    if(inputUnits[i].processIndex == undefined)
      inputUnits[i].computeProcessIndex(history)
    if(inputUnits[i].processIndex > max)
      max = inputUnits[i].processIndex
  }

  this.processIndex = max + 1

  var outputUnits = this.outputUnits.filter((unit) => {
    return (history.indexOf(unit) == -1)
  })
  for(var i in outputUnits) {
    if(outputUnits[i].processIndex == undefined ||
      outputUnits[i].processIndex <= this.processIndex) {
      outputUnits[i].computeProcessIndex(history)
    }
  }

  return this.processIndex
}

Unit.prototype.computeStepsToNecessity = function(history) {
  console.log("NO IDEA IF THIS WORKS!")
  if(this.stepsToNecessity === 1)
    return 1

  history = (history || []).concat([this])
  var neighbours = this.neighbours.filter(unit => (history.indexOf(unit) == -1))

  if(this.stepsToNecessity == undefined) {
    var winner = Infinity
    for(var i in neighbours) {
      if(neighbours[i].stepsToNecessity == undefined)
        neighbours[i].computeStepsToNecessity(history)
      if(neighbours[i].stepsToNecessity && neighbours[i].stepsToNecessity < winner)
        winner = neighbours[i].stepsToNecessity
    }
    if(winner != Infinity)
      return this.stepsToNecessity = winner + 1
    else
      return this.stepsToNecessity = null

  } else {

    var oldScore = this.stepsToNecessity
    this.stepsToNecessity = undefined
    var winner = Infinity
    for(var i in neighbours) {
      neighbours[i].computeStepsToNecessity(history)
      if(neighbours[i].stepsToNecessity !== null && neighbours[i].stepsToNecessity < winner)
        winner = neighbours[i].stepsToNecessity
    }
    if(winner != Infinity)
      return this.stepsToNecessity = winner + 1
    else
      return this.stepsToNecessity = null
  }
}
Unit.prototype.markAsNecessary = function() {
  this.stepsToNecessity = 1
}

Unit.prototype.__defineGetter__("defaultInlet", function() {
  return this.inletsOrdered[0]
})
Unit.prototype.__defineGetter__("defaultOutlet", function() {
  return this.outletsOrdered[0]
})
Unit.prototype.__defineGetter__("topInlet", function() {
  var inlet = this.defaultInlet
  if(inlet.connected)
    return inlet.outlet.unit.topInlet
  else return inlet
})


Unit.prototype.addEvent = function(newEvent) {
  if(this.circuit)
    this.circuit.addEvent(newEvent)
  else {
    for(var i=0; i<this.events.length; i++)
      if(newEvent.t < this.events[i].t) {
        this.events.splice(i, 0, newEvent)
        return ;
      }
    // if we get here the new event must be after all others
    this.events.push(newEvent)
  }
}


Unit.prototype.addPromise = function(promise) {
  if(this.circuit)
    this.circuit.addPromise(promise)
  else
    this.promises.push(promise)
}

Unit.prototype.getOrBuildCircuit = function() {
  if(this.circuit)
    return this.circuit
  else
    return new Circuit(this)
}

Unit.prototype.trigger = function() {
  var inputUnits = this.inputUnits
  for(var i in inputUnits)
    inputUnits[i].trigger()
}
Unit.prototype.stop = function() {
  var inputUnits = this.inputUnits
  for(var i in inputUnits)
    inputUnits[i].stop()
}

},{"./Circuit":47,"./Inlet.js":49,"./Outlet.js":50,"./UnitOrPatch.js":56,"./config.js":122}],56:[function(require,module,exports){
const Event = require("./Event.js")

function UnitOrPatch() {
}
module.exports = UnitOrPatch

UnitOrPatch.prototype.isUnitOrPatch = true

UnitOrPatch.prototype.schedule = function(time /*seconds*/, func) {
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

UnitOrPatch.prototype.scheduleTrigger = function(t, val) {
  if(!this.trigger)
    throw this.label + ": cannot call scheduleTrigger because trigger is undefined"

  // perhaps this function belongs in Unit?
  this.schedule(t, function() {
    this.trigger(val)
  })
}

UnitOrPatch.prototype.scheduleRelease = function() {
  if(this.release)
    this.schedule(t, function() {
      this.release(p, note)
    })
}

UnitOrPatch.prototype.scheduleNote = function(note, semiquaverInSamples, t0) {
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

UnitOrPatch.prototype.scheduleTrack = function(track, bpm, t0) {
  var bpm = bpm || track.bpm || 120
  var semiquaverInSamples = 60/4 / bpm
  var t0 = t0 || 0
  track = track.splitArraySounds()

  for(var i in track.notes) {
    this.scheduleNote(track.notes[i], semiquaverInSamples, t0)
  }
}

UnitOrPatch.prototype.render = function(t) {
  if(this.defaultOutlet)
    return this.defaultOutlet.render(t)
  else
    throw this.label + " has no outlets. cannot render."
}

UnitOrPatch.prototype.finish = function() {
  // _finish should be for unit specific implementations, onFinish could be used as an addition
  this.finished = true
  if(this._finish)
    this._finish()
  if(this.onFinish)
    this.onFinish()
}
UnitOrPatch.prototype.scheduleFinish = function(t) {
//  this.possiblyInfinite = false
  this.schedule(t, () => {
    this.finish()
  })
}

},{"./Event.js":48}],57:[function(require,module,exports){
const Unit = require("../Unit.js")
const config = require("../config.js")

const samplePeriod = 1/config.sampleRate

class AHD extends Unit {
  constructor(attack, hold, decay) {
    super()

    this.addInlet("attack", {mono: true, type:"time", measuredIn:"s"})
    this.addInlet("hold", {mono: true, type:"time", measuredIn:"s"})
    this.addInlet("decay", {mono: true, type:"time", measuredIn:"s"})
    this.addOutlet("out", {mono: true, type:"control", min:0, max:1})

    this.ATTACK = attack || 0
    this.HOLD = hold || 0
    this.DECAY = decay || 0

    this.state = 0
    this.playing = false
    this.t = 0
  }

  trigger() {
    this.state = 1
    this.playing = true
    return this
  }
  stop() {
    this.state = 0
    this.playing = false
    return this
  }

  _tick() {
    for(var t=0; t<this.tickInterval; t++) {
      switch(this.state) {
        case 1: // attack
          this.out[t] = this.t
          if(this.playing) {
            this.t += samplePeriod/this.attack[t]
            if(this.t >= 1) {
              this.state++
              this.t--
            }
          }
          break;

        case 2: // hold
          this.out[t] = 1
          if(this.playing) {
            this.t += samplePeriod/this.hold[t]
            if(this.t >= 1) {
              this.state++
              this.t--
            }
          }
          break;

        case 3: // decay
          this.out[t] = 1-this.t

          if(this.playing) {
            this.t += samplePeriod/this.decay[t]
            if(this.t >= 1) {
              this.stop()
            }
          }
          break;

        case 0: // off
          this.out[t] = 0

      }
    }
  }
}
module.exports = AHD

AHD.random = function(duration) {
  var a = Math.random()
  var h = Math.random()
  var d = Math.random()
  var scale = duration/(a + h + d)

  a *= scale
  h *= scale
  d *= scale

  return new AHD(a, h, d)
}

},{"../Unit.js":55,"../config.js":122}],58:[function(require,module,exports){
const Unit = require("../Unit.js")

function Abs(input) {
  Unit.call(this)

  this.addInlet("in")
  this.addOutlet("out")

  this.IN = input || 0
}
Abs.prototype = Object.create(Unit.prototype)
Abs.prototype.constructor = Abs
module.exports = Abs

Abs.prototype.isAbs = true

Abs.prototype._tick = function() {
  for(var c=0; c<this.in.length; c++) {
    this.out[c] = this.out[c] || new Float32Array(Unit.standardChunkSize)
    for(var t=0; t<this.in[c].length; t++) {
      this.out[c][t] = Math.abs(this.in[c][t])
    }
  }
}

},{"../Unit.js":55}],59:[function(require,module,exports){
const CombFilter = require("./CombFilter.js")

class AllPass extends CombFilter {
  constructor(delayTime, feedbackGain) {
    super(delayTime, feedbackGain)
  }

  _tick() {
    for(var t=0; t<this.in.length; t++) {
      this.tBuffer = (this.tBuffer+1)%this.buffer.length
      var delayOut = this.buffer[this.tBuffer]
      this.buffer[this.tBuffer] = this.in[t] + delayOut * this.feedbackGain[t]
      this.out[t] = delayOut - this.in[t] * this.feedbackGain[t]
    }
  }
}
module.exports = AllPass

AllPass.random = function(maxDelayTime, maxFeedbackGain) {
  return new AllPass(
    (maxDelayTime || 1) * Math.random(), // delay time
    (maxFeedbackGain || 1) * Math.random(), // feedbackGain
  )
}

AllPass.manyRandom = function(n, maxDelay, maxFeedback) {
  var list = []
  for(var i=0; i<n; i++) {
    var delay = 2/this.sampleRate + Math.random()*(maxDelay-2/this.sampleRate)
    while(delay == 0)
      var delay = Math.random()*maxDelay

    var ap = new AllPass(Math.random()*maxDelay, Math.random()*maxFeedback)
    list.push(ap)
  }
  return list
}

AllPass.manyRandomInSeries = function(n, maxDelayTime, maxFeedbackGain) {
  var allpasses = []
  for(var i=0; i<n; i++) {
    allpasses[i] = AllPass.random(maxDelayTime, maxFeedbackGain)
    if(i != 0)
      allpasses[i].IN = allpasses[i-1].OUT
  }
  return {
    list: allpasses,
    IN: allpasses[0].IN,
    OUT: allpasses[i-1].OUT,
  }
}

},{"./CombFilter.js":64}],60:[function(require,module,exports){
/*
  A base class for CircleBufferReader and CircleBufferWriter.
*/

const Unit = require("../Unit.js")

class CircleBufferNode extends Unit {
  constructor(buffer, offset) {
    super()

    this.t = 0
    if(buffer)
      this.buffer = buffer

    this.addInlet("offset", {measuredIn:"s"})
    this.OFFSET = offset || 0
  }

  set buffer(buffer) {
    if(this.OUT && this.OUT.isOutlet)
      while(this.out.length < buffer.numberOfChannels)
        this.out.push( new Float32Array(this.OUT.chunkSize) )
    this.channelData = buffer.channelData
    this.lengthInSamples = buffer.lengthInSamples
    this.numberOfChannels = buffer.numberOfChannels
    this._buffer = buffer
  }
  get buffer() {
    return this._buffer
  }
}
module.exports = CircleBufferNode

},{"../Unit.js":55}],61:[function(require,module,exports){
const CircleBufferNode = require("./CircleBufferNode.js")

class CircleBufferReader extends CircleBufferNode {
  constructor(buffer, offset) {
    super(null, offset)
    this.addOutlet("out")

    this.buffer = buffer
    this.postWipe = false
  }

  _tick() {
    for(var c=0; c<this.numberOfChannels; c++) {
      var offset = this.offset[c%this.offset.length]
      for(var t=0; t<this.tickInterval; t++) {
        var tRead = this.t + t - this.sampleRate*offset[t]
        this.out[c][t] = this._buffer.read(c, tRead)

        if(this.postWipe)
          this._buffer.write(c, tRead, 0)
      }
    }

    this.t += this.tickInterval
  }
}
module.exports = CircleBufferReader

},{"./CircleBufferNode.js":60}],62:[function(require,module,exports){
const CircleBufferNode = require("./CircleBufferNode.js")

class CircleBufferWriter extends CircleBufferNode {
  constructor(buffer, offset) {
    super(buffer, offset)

    this.addInlet("in")

    this.preWipe = false
  }

  _tick() {
    for(var c=0; c<this.numberOfChannels; c++) {
      var offset = this.offset[c % this.offset.length]
      for(var t=0; t<this.tickInterval; t++) {
        var tWrite = this.t + t + this.sampleRate * offset[t]
        if(this.preWipe)
          this._buffer.write(c, tWrite, 0)
        if(this.in[c])
          this._buffer.mix(c, tWrite, this.in[c][t])
      }
    }

    this.t += this.tickInterval
  }
}
module.exports = CircleBufferWriter

},{"./CircleBufferNode.js":60}],63:[function(require,module,exports){
const Unit = require("../Unit.js")

class Clip extends Unit {
  constructor(threshold) {
    super()
    this.addInlet("in")
    this.addInlet("threshold")
    this.addOutlet("out")
    this.THRESHOLD = threshold
  }

  _tick() {
    for(var c=0; c<this.in.length; c++) {
      var inChannel = this.in[c]
      var thresholdChannel = this.threshold[c%this.threshold.length]
      var outChannel = this.out[c] = this.out[c] || new Float32Array(this.OUT.chunkSize)
      for(var t=0; t<inChannel.length; t++)
        outChannel[t] = Math.abs(inChannel[t]) > Math.abs(thresholdChannel[t])
                          ? thresholdChannel[t] : inChannel[t]
    }
  }
}
module.exports = Clip

},{"../Unit.js":55}],64:[function(require,module,exports){
const FixedDelay = require("./FixedDelay.js")

class CombFilter extends FixedDelay {
  constructor(delayTime, feedbackGain) {
    super(delayTime)

    this.addInlet("feedbackGain", {mono: true, type:"scalar"})
    this.FEEDBACKGAIN = feedbackGain || 0
  }

  _tick() {
    for(var t=0; t<this.in.length; t++) {
      this.tBuffer = (this.tBuffer+1)%this.buffer.length
      this.out[t] = this.buffer[this.tBuffer]
      this.buffer[this.tBuffer] = this.in[t] + this.out[t] * this.feedbackGain[t]
    }
  }

  get totalReverbTime() {
    return this.delayTimeInSeconds * Math.log(0.001) / Math.log(this.feedbackGain[this.feedbackGain.length-1])
  }
  set totalReverbTime(RVT) {
    this.FEEDBACKGAIN = Math.pow(0.001, this.delayTimeInSeconds/RVT)
  }
}
module.exports = CombFilter

},{"./FixedDelay.js":71}],65:[function(require,module,exports){
const Unit = require("../Unit.js")

function ConcatChannels(A, B) {
  Unit.call(this)
  this.addInlet("a")
  this.addInlet("b")
  this.addOutlet("out")

  this.A = A || 0
  this.B = B || 0
}
ConcatChannels.prototype = Object.create(Unit.prototype)
ConcatChannels.prototype.constructor = ConcatChannels
module.exports = ConcatChannels

ConcatChannels.prototype._tick = function() {
  var nCOut = this.a.length + this.b.length
  for(var c=0; c<this.a.length; c++) {
    var outChunk = this.out[c] = this.out[c] || new Float32Array(this.OUT.chunkSize)
    var inChunk = this.a[c]
    for(var t=0; t<inChunk.length; t++)
      outChunk[t] = inChunk[t]
  }
  for(c=c; c<nCOut; c++) {
    var outChunk = this.out[c] = this.out[c] || new Float32Array(this.OUT.chunkSize)
    var inChunk = this.b[c-this.a.length]
    for(var t=0; t<inChunk.length; t++)
      outChunk[t] = inChunk[t]
  }
}

},{"../Unit.js":55}],66:[function(require,module,exports){
const Unit = require("../Unit.js")

function CrossFader(a, b, dial) {
  Unit.call(this)
  this.addInlet("a", {type:"audio"})
  this.addInlet("b", {type:"audio"})
  this.addInlet("dial", {mono: true, min:0, max:1, zero:0.5})
  this.addOutlet("out", {type:"audio"})

  this.A = a || 0
  this.B = b || 0
  this.DIAL = dial || 0 // 0: all A, 1: all B
}
CrossFader.prototype = Object.create(Unit.prototype)
CrossFader.prototype.constructor = CrossFader
module.exports = CrossFader

const zeroChannel = new Float32Array(Unit.standardChunkSize).fill(0)

CrossFader.prototype._tick = function() {
  for(var c=0; c<this.a.length || c<this.b.length; c++) {
    var aChannel = this.a[c] || zeroChannel
    var bChannel = this.b[c] || zeroChannel
    this.out[c] = this.out[c] || new Float32Array(aChannel.length)
    for(var t=0; t<aChannel.length; t++) {
      this.out[c][t] = (1-this.dial[t])*aChannel[t] + this.dial[t] * bChannel[t]
    }
  }
}

},{"../Unit.js":55}],67:[function(require,module,exports){
const Unit = require("../Unit.js")

function DecibelToScaler(input) {
  Unit.call(this)
  this.addInlet("in", {measuredIn:"dB"})
  this.addOutlet("out")
  this.IN = input || 0
}
DecibelToScaler.prototype = Object.create(Unit.prototype)
DecibelToScaler.prototype.constructor = DecibelToScaler
module.exports = DecibelToScaler

DecibelToScaler.prototype._tick = function() {
  for(var c=0; c<this.in.length; c++) {
    this.out[c] = this.out[c] || new Float32Array(this.in[c].length)
    for(var t=0; t<this.in[c].length; t++)
      this.out[c][t] = Math.pow(10, this.in[c][t]/20)
  }
}

},{"../Unit.js":55}],68:[function(require,module,exports){
const Unit = require("../Unit.js")
const config = require("../config.js")

const zeroChunk = new Float32Array(config.standardChunkSize).fill(0)

class Delay extends Unit {
  constructor(input, delay, maxDelay) {
    super()
    this.addInlet("in")
    this.addInlet("delay", {measuredIn:"samples"})
    this.addOutlet("out")

    this.maxDelay = maxDelay || Unit.sampleRate * 5
    this.buffers = [new Float32Array(this.maxDelay)]

    this.IN = input || 0
    this.DELAY = delay || 4410
  }

  _tick(clock) {
    for(var c=0; c<this.in.length || c<this.delay.length; c++) {
      this.out[c] = this.out[c] || new Float32Array(this.OUT.chunkSize)
      this.in[c] = this.in[c%this.in.length]
      this.buffers[c] = this.buffers[c] || new Float32Array(this.maxDelay)
      var delayChunk = this.delay[c%this.delay.length]
      for(var t=0; t<this.in[c].length; t++) {
        var tBuffer = (clock + t)%this.buffers[c].length
        this.out[c][t] = this.buffers[c][tBuffer]
        this.buffers[c][tBuffer] = 0
        /*if(this.delay[c][t] >= this.buffers[c].length)
          console.log(
            this.label+":", "delay time exceded buffer size by",
            delayChunk[t]-this.buffers[c].length+1,
            "samples (channel: " + c + ")"
          )*/
        var tWrite = (tBuffer + delayChunk[t])%this.buffers[c].length
        this.buffers[c][Math.floor(tWrite)] += this.in[c][t] * (1-tWrite%1)
        this.buffers[c][Math.ceil(tWrite)] += this.in[c][t] * (tWrite%1)
      }
    }
  }
}
module.exports = Delay

},{"../Unit.js":55,"../config.js":122}],69:[function(require,module,exports){
const Unit = require("../Unit.js")

function Divide(a, b) {
  Unit.call(this)
  this.addInlet("a")
  this.addInlet("b")
  this.addOutlet("out")

  this.A = a || 1
  this.B = b || 1
}
Divide.prototype = Object.create(Unit.prototype)
Divide.prototype.constructor = Divide
module.exports = Divide

Divide.prototype._tick = function(clock) {
  var outData = this.out
  var chunkSize = this.OUT.chunkSize
  for(var c=0; c<this.a.length || c<this.b.length; c++) {
    var aChan = this.a[c%this.a.length]
    var bChan = this.b[c%this.b.length]
    var outChan = outData[c] = outData[c] || new Float32Array(chunkSize)
    for(var t=0; t<chunkSize; t++) {
      outChan[t] = aChan[t] / bChan[t]
    }
  }
}

},{"../Unit.js":55}],70:[function(require,module,exports){
// A butterworth filter

const Unit = require("../Unit.js")

function Filter(input, f, kind) {
  Unit.call(this)

  this.addInlet("in", {type:"audio"})
  this.addInlet("f", {mono: true, measuredIn:"Hz"})
  this.addOutlet("out", {type:"audio"})

  if(input)
    this.IN = input
  if(f)
    this.F = f
  this.kind = kind || "LP"

  this.x1 = [] // input delayed by one samples for each channel
  this.x2 = [] // input delated by two samples for each channel
  this.y1 = [] // output delayed by one samples for each channel
  this.y2 = [] // output delayed by two samples for each channel
}
Filter.prototype = Object.create(Unit.prototype)
Filter.prototype.constructor = Filter
module.exports = Filter

Filter.prototype._tick = function() {
  var numberOfChannels = this.in.length
  var chunkSize = this.IN.chunkSize

  while(this.out.length < this.in.length)
    this.out.push(new Float32Array(this.OUT.chunkSize))
  for(var t=0; t<chunkSize; t++) {
    if(this.f[t] != this.lastF) {
      this.lastF = this.f[t]
      this.calculateCoefficients(this.f[t])
    }
    for(var c=0; c<numberOfChannels; c++) {
      //this.out[c][t] = this.a0 * this.in[c][t] - this.a2 * (this.x2[c] || 0) - this.b1 * (this.y1[c] || 0) - this.b2 * (this.y2[c] || 0) /*
      this.out[c][t] = this.a0 * this.in[c][t]
                      + this.a1 * (this.x1[c] || 0)
                      + this.a2 * (this.x2[c] || 0)
                      - this.b1 * (this.y1[c] || 0)
                      - this.b2 * (this.y2[c] || 0)//*/
      this.y2[c] = this.y1[c] || 0
      this.y1[c] = this.out[c][t]
      this.x2[c] = this.x1[c] || 0
      this.x1[c] = this.in[c][t]
    }
  }
}

Filter.prototype.__defineGetter__("kind", function() {
  return this._kind
})
Filter.prototype.__defineSetter__("kind", function(kind) {
  this.calculateCoefficients = Filter.coefficientFunctions[kind]
  if(!this.calculateCoefficients)
    throw "invalid filter type: " + kind
  if(kind == 'HP')
    console.warn("Please note: High Pass filter has a bug and doesn't work")
  this._kind = kind
  this.calculateCoefficients()
})

Filter.coefficientFunctions = {
  LP: function(f) {
    var lamda = 1/Math.tan(Math.PI * f/this.sampleRate)
    var lamdaSquared = lamda * lamda
    this.a0 = 1/(1 + 2*lamda + lamdaSquared)
    this.a1 = 2 * this.a0
    this.a2 = this.a0
    this.b1 = 2 * this.a0 * (1 - lamdaSquared)
    this.b2 = this.a0 * (1 - 2 * lamda + lamdaSquared)
  },
  HP: function(f) {
    var lamda = Math.tan(Math.PI * f / this.sampleRate) // checked
    var lamdaSquared = lamda * lamda // checked
    this.a0 = 1/(1 + 2*lamda + lamdaSquared) // checked
    this.a1 = 0//2 * this.a0 //checked
    this.a2 = -this.a0 // checked
    this.b1 = 2 * this.a0 * (lamdaSquared-1)
    this.b2 = this.a0 * (1 - 2*lamda + lamdaSquared)
  },
  BP: function(f, bandwidth) {
    var lamda = 1/Math.tan(Math.PI * bandwidth/this.sampleRate)
    var phi = 2 * Math.cos(2*Math.PI * f/this.sampleRate)
    this.a0 = 1/(1+lamda)
    this.a1 = 0
    this.a2 = -this.a0
    this.b1 = - lamda * phi * this.a0
    this.b2 = this.a0 * (lamda - 1)
  },
  BR: function(f, bandwidth) {
    var lamda = Math.tan(Math.PI * bandwidth/this.sampleRate)
    var phi = 2 * Math.cos(2*Math.PI * f/this.sampleRate)
    this.a0 = 1/(1+lamda)
    this.a1 = - phi * this.a0
    this.a2 = this.a0
    this.b1 = - phi * this.a0
    this.b2 = this.a0 * (lamda - 1)
    console.log(f, this)
  },
}

},{"../Unit.js":55}],71:[function(require,module,exports){
const Unit = require("../Unit.js")

class FixedDelay extends Unit {
  constructor(delayTime) {
    super()

    this.addInlet("in", {mono: true, type:"audio"})
    this.addOutlet("out", {mono: true, type:"audio"})

    this.setSeconds(delayTime)
    this.tBuffer = 0
  }

  _tick() {
    for(var t=0; t<this.in.length; t++) {
      this.tBuffer = (this.tBuffer+1)%this.buffer.length
      this.out[t] = this.buffer[this.tBuffer]
      this.buffer[this.tBuffer] = this.in[t]
    }
  }

  setDelayTime(tSamples) {
    if(!tSamples || tSamples < 0.5)
      throw "Cannot have fixed delay of length 0 samples"
    this.delayTimeInSamples = Math.round(tSamples)
    this.delayTimeInSeconds = tSamples/this.sampleRate
    this.buffer = new Float32Array(this.delayTimeInSamples)
  }

  setSeconds(duration) {
    this.setDelayTime(duration*this.sampleRate)
  }

  setFrequency(f) {
    this.setSeconds(1/f)
  }
}
module.exports = FixedDelay

},{"../Unit.js":55}],72:[function(require,module,exports){
const Unit = require("../Unit.js")

function FixedMultiply(sf, input) {
  Unit.call(this)

  this.addInlet("in", {mono: true})
  this.addOutlet("out", {mono: true})

  this.sf = sf

  this.IN = input || 0
}
FixedMultiply.prototype = Object.create(Unit.prototype)
FixedMultiply.prototype.constructor = FixedMultiply
module.exports = FixedMultiply

FixedMultiply.prototype.isFixedMultiply = true

FixedMultiply.prototype._tick = function() {
  for(var t=0; t<this.in.length; t++)
    this.out[t] = this.in[t] * this.sf
}

},{"../Unit.js":55}],73:[function(require,module,exports){
const Unit = require("../Unit.js")

function Gain(gain) {
  Unit.call(this)
  this.addInlet("in")
  this.addInlet("gain", {mono: true, measuredIn: "dB"})
  this.addOutlet("out")

  this.GAIN = gain || 0
}
Gain.prototype = Object.create(Unit.prototype)
Gain.prototype.constructor = Gain
module.exports = Gain

Gain.prototype.isGain

Gain.prototype._tick = function() {
  for(var c=0; c<this.in.length; c++) {
    if(this.out[c] == undefined)
      this.out[c] = new Float32Array(this.OUT.chunkSize)
    for(var t=0; t<Unit.standardChunkSize; t++)
      this.out[c][t] = dB(this.gain[t]) * this.in[c][t]
  }
}

function dB(db) { // decibel to scale factor (for amplitude calculations)
  return Math.pow(10, db/20);
}

},{"../Unit.js":55}],74:[function(require,module,exports){
const Unit = require("../Unit.js")

function GreaterThan(input, val) {
  console.log("WARNING GreaterThan is untested!")
  Unit.call(this)
  this.addInlet("in", {mono: true})
  this.addInlet("val", {mono: true})
  this.addOutlet("out", "bool")

  this.IN = input || 0
  this.VAL = val || 0
}
GreaterThan.prototype = Object.create(Unit.prototype)
GreaterThan.prototype.constructor = GreaterThan
module.exports = GreaterThan

GreaterThan.prototype._tick = function() {
  for(var t=0; t<this.in.length; t++) {
    this.out[t] = (this.in[t] > this.val[t])
  }
}

},{"../Unit.js":55}],75:[function(require,module,exports){
const Unit = require("../Unit.js")

class HardClipAbove extends Unit {
  constructor(input, threshold) {
    super()
    this.addInlet("in")
    this.addInlet("threshold")
    this.addOutlet("out")

    this.IN = input || 0
    this.THRESHOLD = threshold || 0
  }

  _tick() {
    for(var c=0; c<this.in.length; c++) {
      this.out[c] = this.out[c] || new Float32Array(this.OUT.chunkSize)
      var threshold = this.threshold[c%this.threshold.length]
      for(var t=0; t<this.in[c].length; t++)
        if(this.in[c][t] > threshold[t])
          this.out[c][t] = threshold[t]
        else
          this.out[c][t] = this.in[c][t]
    }
  }
}
module.exports = HardClipAbove

},{"../Unit.js":55}],76:[function(require,module,exports){
const Unit = require("../Unit.js")

class HardClipBelow extends Unit {
  constructor(input, threshold) {
    super()
    this.addInlet("in")
    this.addInlet("threshold")
    this.addOutlet("out")

    this.IN = input || 0
    this.THRESHOLD = threshold || 0
  }

  _tick() {
    for(var c=0; c<this.in.length; c++) {
      this.out[c] = this.out[c] || new Float32Array(this.OUT.chunkSize)
      var threshold = this.threshold[c%this.threshold.length]
      for(var t=0; t<this.in[c].length; t++)
        if(this.in[c][t] < threshold[t])
          this.out[c][t] = threshold[t]
        else
          this.out[c][t] = this.in[c][t]
    }
  }
}
module.exports = HardClipBelow

},{"../Unit.js":55}],77:[function(require,module,exports){
const Unit = require("../Unit.js")

function LessThan(input, val) {
  console.log("WARNING: LessThan is untested")
  Unit.call(this)
  this.addInlet("in", {mono: true})
  this.addInlet("val", {mono: true})
  this.addOutlet("out", "bool")

  this.IN = input || 0
  this.VAL = val || 0
}
LessThan.prototype = Object.create(Unit.prototype)
LessThan.prototype.constructor = LessThan
module.exports = LessThan

LessThan.prototype._tick = function() {
  for(var t=0; t<this.in.length; t++) {
    this.out[t] = (this.in[t] < this.val[t])
  }
}

},{"../Unit.js":55}],78:[function(require,module,exports){
const Unit = require("../Unit.js")

function MidiToFrequency(midi) {
  Unit.call(this)
  this.addInlet("midi", {type:"midi"})
  this.addOutlet("frequency", {measuredIn: "Hz"})

  this.MIDI = midi || 69
}
MidiToFrequency.prototype = Object.create(Unit.prototype)
MidiToFrequency.prototype.constructor = MidiToFrequency
module.exports = MidiToFrequency

MidiToFrequency.prototype._tick = function() {
  for(var c=0; c<this.midi.length; c++) {
    var midiIn = this.midi[c]
    var fOut = this.frequency[c] || new Float32Array(this.FREQUENCY.chunkSize)
    for(var t=0; t<midiIn.length; t++)
      fOut[t] = Math.pow(2, ((midiIn[t]-69)/12)) * 440
  }
}

},{"../Unit.js":55}],79:[function(require,module,exports){
const Unit = require("../Unit.js")

function Monitor(input) {
  Unit.call(this)
  this.addInlet("in")

  this.IN = input
}
Monitor.prototype = Object.create(Unit.prototype)
Monitor.prototype.constructor = Monitor
module.exports = Monitor

Monitor.prototype._tick = function() {
  console.log(this.in)
}

},{"../Unit.js":55}],80:[function(require,module,exports){
const Unit = require("../Unit.js")

function MonoDelay(input, delay) {
  Unit.call(this)
  this.addInlet("in", {mono: true, type:"audio"})
  this.addInlet("delay", {mono: true, measuredIn: "samples"})
  this.addOutlet("out", {mono: true, type:"audio"})

  this.maxDelay = Unit.sampleRate * 5
  this.buffer = new Float32Array(this.maxDelay)

  this.IN = input || 0
  this.DELAY = delay || 4410
}
MonoDelay.prototype = Object.create(Unit.prototype)
MonoDelay.prototype.constructor = MonoDelay
module.exports = MonoDelay

MonoDelay.prototype._tick = function(clock) {
  for(var t=0; t<this.in.length; t++) {
    var tBuffer = (clock + t)%this.buffer.length
    if(this.delay[t] >= this.buffer.length)
      console.log(this.label+":", "delay time exceded buffer size by", this.delay[t]-this.buffer.length+1, "samples")
    var tWrite = (tBuffer + this.delay[t])%this.buffer.length
    this.buffer[Math.floor(tWrite)] += this.in[t] * (1-tWrite%1)
    this.buffer[Math.ceil(tWrite)%this.buffer.length] += this.in[t] * (tWrite%1)
    this.out[t] = this.buffer[tBuffer]
    this.buffer[tBuffer] = 0
  }
}

},{"../Unit.js":55}],81:[function(require,module,exports){
const Unit = require("../Unit.js")
const dusp = require("../dusp")

function Multiply(a, b) {
  Unit.call(this)
  this.addInlet("a")
  this.addInlet("b")
  this.addOutlet("out")

  this.A = a || 1
  this.B = b || 1
}
Multiply.prototype = Object.create(Unit.prototype)
Multiply.prototype.constructor = Multiply
module.exports = Multiply

Multiply.prototype.dusp = {
  shorthand: function(index) {
    return "(" + dusp(this.A, index) + " * " + dusp(this.B, index) + ")"
  }
}

Multiply.prototype._tick = function(clock) {
  var outData = this.out
  var chunkSize = this.OUT.chunkSize
  for(var c=0; c<this.a.length || c<this.b.length; c++) {
    var aChan = this.a[c%this.a.length]
    var bChan = this.b[c%this.b.length]
    var outChan = outData[c] = outData[c] || new Float32Array(chunkSize)
    for(var t=0; t<chunkSize; t++) {
      outChan[t] = aChan[t] * bChan[t]
    }
  }
}

},{"../Unit.js":55,"../dusp":133}],82:[function(require,module,exports){
const Unit = require("../Unit.js")

function Noise(f) {
  Unit.call(this)
  this.addInlet("f", {measuredIn:"Hz"})
  this.addOutlet("out", {type:"audio"})

  this.F = f || Unit.sampleRate
  this.phase = 0
  this.y = Math.random()*2 - 1
}
Noise.prototype = Object.create(Unit.prototype)
Noise.prototype.constructor = Noise
module.exports = Noise

Noise.prototype._tick = function() {
  for(var c in this.out) {
    var outChan = this.out[c]
    for(var t=0; t<outChan.length; t++) {
      this.phase += this.f[0][t]
      if(this.phase >= Unit.sampleRate) {
        this.phase = 0
        this.y = 2 * Math.random() - 1
      }
      outChan[t] = this.y
    }
  }
}

},{"../Unit.js":55}],83:[function(require,module,exports){
const Unit = require("../../Unit.js")
const config = require("../../config.js")
const waveTables = require("./waveTables.js")

const PHI = 2 * Math.PI

function MultiChannelOsc(f, waveform) {
  Unit.call(this)

  this.addInlet("f", {measuredIn:"Hz"})
  this.addOutlet("out", {type:"audio"})

  this.F = f || 440
  this.phase = []
  this.waveform = waveform || "sin"
}
MultiChannelOsc.prototype = Object.create(Unit.prototype)
MultiChannelOsc.prototype.constructor = MultiChannelOsc
module.exports = MultiChannelOsc

MultiChannelOsc.prototype._tick = function(clock) {
  for(var c=0; c<this.f.length; c++) {
    this.phase[c] = this.phase[c] || 0
    this.out[c] = this.out[c] || new Float32Array(this.OUT.chunkSize)

    var f = this.f[c]
    var dataOut = this.out[c]

    var fraction
    for(var t=0; t<dataOut.length; t++) {
      this.phase[c] += f[t]
      this.phase[c] %= Unit.sampleRate
      fraction = this.phase[c]%1
      dataOut[t] = this.waveTable[Math.floor(this.phase[c])] * (1-fraction)
                    + this.waveTable[Math.ceil(this.phase[c])] * fraction
    }
  }
}

MultiChannelOsc.prototype.__defineGetter__("waveform", function() {
  return this._waveform
})
MultiChannelOsc.prototype.__defineSetter__("waveform", function(waveform) {
  if(waveform == "random") {
    var all = Object.keys(waveTables)
    waveform = all[Math.floor(Math.random()*all.length)]
  }
  this._waveform = waveform
  this.waveTable = waveTables[waveform]
  if(!this.waveTable)
    throw "waveform doesn't exist: " + waveform
})

MultiChannelOsc.prototype.resetPhase = function() {
  for(var i in this.phase)
    this.phase[i] = 0
}
MultiChannelOsc.prototype.randomPhaseFlip = function() {
  if(Math.random() < 0.5)
    for(var i in this.phase)
      this.phase[i] += config.sampleRate/2
}

},{"../../Unit.js":55,"../../config.js":122,"./waveTables.js":86}],84:[function(require,module,exports){

const Unit = require("../../Unit.js")
const waveTables = require("./waveTables.js")

const PHI = 2 * Math.PI

function Osc(f, waveform) {
  Unit.call(this)

  //console.log(this)
  this.addInlet("f", {mono: true, measuredIn:"Hz"})
  this.addOutlet("out", {mono: true, type:"audio"})

  this.F = f || 440
  this.phase = 0
  this.waveform = waveform || "sin"
}
Osc.prototype = Object.create(Unit.prototype)
Osc.prototype.constructor = Osc
module.exports = Osc

Osc.prototype.dusp = {
  extraProperties: {
    waveform: "sin",
  },
  shorthand: function() {
    if(this.waveform == "sin") {
      if(!this.F.connected) {
        return "O" + this.F.constant
      }
    }
  }
}

Osc.prototype._tick = function(clock) {
  var dataOut = this.out
  var fraction
  for(var t=0; t<dataOut.length; t++) {
    this.phase += this.f[t]
    this.phase %= Unit.sampleRate
    if(this.phase < 0)
      this.phase += Unit.sampleRate
    fraction = this.phase%1
    dataOut[t] = this.waveTable[Math.floor(this.phase)] * (1-fraction)
                  + this.waveTable[Math.ceil(this.phase)] * fraction
  }
}

Osc.prototype.__defineGetter__("waveform", function() {
  return this._waveform
})
Osc.prototype.__defineSetter__("waveform", function(waveform) {
  if(waveform == "random") {
    var all = Object.keys(waveTables)
    waveform = all[Math.floor(Math.random()*all.length)]
  }
  this._waveform = waveform
  this.waveTable = waveTables[waveform]
  if(!this.waveTable)
    throw "waveform doesn't exist: " + waveform
})

Osc.prototype.randomPhaseFlip = function() {
  if(Math.random() < 0.5)
    this.phase += Unit.sampleRate/2
}

},{"../../Unit.js":55,"./waveTables.js":86}],85:[function(require,module,exports){
module.exports = require("./Osc")
//module.exports.MultiChannelOsc = require("./MultiChannelOsc")

},{"./Osc":84}],86:[function(require,module,exports){
const config = require("../../config.js")

const PHI = 2 * Math.PI

var sineTable = new Float32Array(config.sampleRate+1)
for(var t=0; t<sineTable.length; t++) {
  sineTable[t] = Math.sin(PHI * t/sineTable.length)
}

var sawTable = new Float32Array(config.sampleRate+1)
for(var t=0; t<config.sampleRate; t++)
  sawTable[t] = -1 + t * 2/sawTable.length

var triangleTable = new Float32Array(config.sampleRate+1)
var quarterSampleRate = config.sampleRate/4
for(var t=0; t<quarterSampleRate; t++) {
  triangleTable[t] = t/config.sampleRate * 4
  triangleTable[t+quarterSampleRate] = 1-triangleTable[t]
  triangleTable[t+quarterSampleRate*2] = -triangleTable[t]
  triangleTable[t+quarterSampleRate*3] = -1+triangleTable[t]
}
triangleTable[config.sampleRate] = 0

var squareTable = new Float32Array(config.sampleRate+1)
squareTable.fill(1, 0, config.sampleRate/2)
squareTable.fill(-1, config.sampleRate/2, config.sampleRate+1)

twoToTheSeven = Math.pow(2, 7)
eightBitTable = sineTable.map(sample =>
  Math.round(sample * twoToTheSeven)/twoToTheSeven
)

module.exports = {
  sin: sineTable,
  sine: sineTable,
  saw: sawTable,
  square: squareTable,
  triangle: triangleTable,
  "8bit": eightBitTable,
}

},{"../../config.js":122}],87:[function(require,module,exports){
const Unit = require("../Unit.js")

function Pan(input, pan) {
  Unit.call(this)

  this.addInlet("in", {mono: true, type:"audio"})
  this.addInlet("pan", {mono: true, min:-1, max:1})
  this.addOutlet("out", {numberOfChannels:2, type:"audio"})

  this.PAN = pan || 0
  this.IN = input || 0
  this.compensationDB = 1.5
}
Pan.prototype = Object.create(Unit.prototype)
Pan.prototype.constructor = Pan
module.exports = Pan

Pan.prototype._tick = function() {
  for(var t=0; t<this.out[0].length; t++) {
    var compensation = dB((1-Math.abs(this.pan[t])) * this.compensationDB)
    this.out[0][t] = this.in[t] * (1-this.pan[t])/2 * compensation
    this.out[1][t] = this.in[t] * (1+this.pan[t])/2 * compensation
  }
}

function dB(db) { // decibel to scale factor (for amplitude calculations)
  return Math.pow(10, db/20);
}

},{"../Unit.js":55}],88:[function(require,module,exports){
const Unit = require("../Unit.js")

function PickChannel(input, c) {
  Unit.call(this)
  this.addInlet("in")
  this.addInlet("c", {mono: true})
  this.addOutlet("out", {mono: true})

  this.IN = input || 0
  this.C = c || 0
}
PickChannel.prototype = Object.create(Unit.prototype)
PickChannel.prototype.constructor = PickChannel
module.exports = PickChannel

PickChannel.prototype._tick = function() {
  var chunkSize = this.OUT.chunkSize
  for(var t=0; t<chunkSize; t++) {
    this.out[t] = this.in[this.c[t] % this.in.length][t]
  }
}

},{"../Unit.js":55}],89:[function(require,module,exports){
const Unit = require("../Unit.js")

class PolarityInvert extends Unit {
  constructor(input) {
    super()

    this.addInlet("in")
    this.addOutlet("out")

    this.IN = input || 0
  }

  _tick() {
    for(var c=0; c<this.in.length; c++) {
      this.out[c] = this.out[c] || new Float32Array(this.OUT.chunkSize)
      for(var t=0; t<this.in[c].length; t++) {
        this.out[c][t] = -this.in[c][t]
      }
    }
  }
}
module.exports = PolarityInvert

},{"../Unit.js":55}],90:[function(require,module,exports){
const Unit = require("../Unit.js")

class Pow extends Unit {
  constructor(a, b) {
    super()
    this.addInlet("a")
    this.addInlet("b")
    this.addOutlet("out")
    this.A = a
    this.B = b
  }

  /*dusp: {
    shorthand: function(index) {
      return "(" + dusp(this.A, index) + " ^ " + dusp(this.B, index) + ")"
    }
  }*/

  _tick() {
    var outData = this.out
    var chunkSize = this.OUT.chunkSize
    for(var c=0; c<this.a.length || c<this.b.length; c++) {
      var aChan = this.a[c%this.a.length]
      var bChan = this.b[c%this.b.length]
      var outChan = outData[c] = outData[c] || new Float32Array(chunkSize)
      for(var t=0; t<chunkSize; t++) {
        outChan[t] = Math.pow(aChan[t], bChan[t])
      }
    }
  }
}
module.exports = Pow

},{"../Unit.js":55}],91:[function(require,module,exports){
const Unit = require("../Unit.js")

function Ramp(duration, y0, y1) {
  Unit.call(this)

  this.addOutlet("out", {mono: true, type:"control"})

  this.duration = duration || this.sampleRate
  this.y0 = y0 || 1
  this.y1 = y1 || 0

  this.t = 0
  this.playing = false
}
Ramp.prototype = Object.create(Unit.prototype)
Ramp.prototype.constructor = Ramp
module.exports = Ramp

Ramp.prototype.trigger = function() {
  this.playing = true
  this.t = 0
  return this
}

Ramp.prototype._tick = function() {
  for(var tChunk=0; tChunk<this.out.length; tChunk++) {
    if(this.playing) {
      this.t++
      if(this.t > this.duration) {
        this.playing = false
        this.t = this.duration
      }
      if(this.t < 0) {
        this.playing = false
        this.t = 0
      }
    }
    this.out[tChunk] = this.y0 + (this.t/this.duration) * (this.y1-this.y0)
  }
}

},{"../Unit.js":55}],92:[function(require,module,exports){
const Unit = require("../Unit.js")
const config = require("../config.js")

function ReadBackDelay(input, delay, bufferLength) {
  Unit.call(this)

  this.addInlet("in")
  this.addInlet("delay", {measuredIn:"samples"})
  this.addOutlet("out")

  this.buffer = []
  this.bufferLength = bufferLength || config.sampleRate
  this.tBuffer = 0 // write head time within buffer

  this.IN = input || 0
  this.DELAY = delay || 0
}
ReadBackDelay.prototype = Object.create(Unit.prototype)
ReadBackDelay.prototype.constructor = ReadBackDelay
module.exports = ReadBackDelay


ReadBackDelay.prototype._tick = function() {
  var t0 = this.tBuffer
  var t1 = t0 + this.tickInterval
  for(var c=0; c<this.in.length || c<this.delay.length; c++) {
    var input = this.in[c%this.in.length]
    var delay = this.delay[c%this.delay.length]
    var output = this.out[c] = this.out[c] || new Float32Array(this.OUT.chunkSize)
    var buffer = this.buffer[c] = this.buffer[c] || new Float32Array(this.bufferLength)

    var i = 0
    for(var t=t0; t<t1; t++) {
      if(delay[i] > this.bufferLength)
        throw "delay may not exceed buffer length ("+this.label+")"

      buffer[(t+buffer.length)%buffer.length] = input[i]
      output[i] = buffer[(t-delay[i] + buffer.length) % buffer.length]
      i++
    }
  }
  this.tBuffer = t1
}

},{"../Unit.js":55,"../config.js":122}],93:[function(require,module,exports){
const Unit = require("../Unit.js")

function Repeater(val, measuredIn) {
  Unit.call(this)
  this.addInlet("in", {measuredIn:measuredIn})
  this.addOutlet("out", {measuredIn:measuredIn})
  this.measuredIn = measuredIn

  this.IN = val || 0
}
Repeater.prototype = Object.create(Unit.prototype)
Repeater.prototype.constructor = Repeater
module.exports = Repeater

Repeater.prototype.dusp = {
  extraArgs: function() {
    if(this.measuredIn)
      return ["\""+this.measuredIn+"\""]
    else return null
  }
}

Repeater.prototype._tick = function() {
  for(var c=0; c<this.in.length; c++) {
    this.out[c] = this.out[c] || new Float32Array(this.in[c].length)

    for(var t=0; t<this.in[c].length; t++)
      this.out[c][t] = this.in[c][t]
  }
}

},{"../Unit.js":55}],94:[function(require,module,exports){
const Unit = require("../Unit.js")

function Rescale(inLower, inUpper, outLower, outUpper) {
  Unit.call(this)
  this.addInlet("in")
  this.addInlet("inLower")
  this.addInlet("inUpper")
  this.addInlet("outLower")
  this.addInlet("outUpper")
  this.addOutlet("out")

  this.IN = 0
  this.INLOWER = inLower || -1
  this.INUPPER = inUpper || 1
  this.OUTLOWER = outLower || 0
  this.OUTUPPER = outUpper || 1
}
Rescale.prototype = Object.create(Unit.prototype)
Rescale.prototype.constructor = Rescale
module.exports = Rescale

Rescale.prototype.isRescale = true

Rescale.prototype._tick = function() {
  for(var c=0; c<this.in.length; c++) {
    var inChan = this.in[c]
    var outChan = this.out[c] = this.out[c] || new Float32Array(Unit.standardChunkSize)
    var inLowerChan = this.inLower[c%this.inLower.length]
    var inUpperChan = this.inUpper[c%this.inUpper.length]
    var outLowerChan = this.outLower[c%this.outLower.length]
    var outUpperChan = this.outUpper[c%this.outUpper.length]
    for(var t=0; t<inChan.length; t++) {
      outChan[t] = (inChan[t]-inLowerChan[t])/(inUpperChan[t]-inLowerChan[t]) *
                    (outUpperChan[t] - outLowerChan[t]) + outLowerChan[t]
    }
  }
}

},{"../Unit.js":55}],95:[function(require,module,exports){
const Unit = require("../Unit.js")

class Retriggerer extends Unit {
  constructor(target, rate) {
    super()
    this.addInlet("rate", {mono:true, type:"frequency"})
    if(target)
      this.target = target
    this.t = 0
    this.RATE = rate || 1
  }

  _tick() {
    for(var t=0; t<this.rate.length; t++) {
      this.t += this.rate[t]
      if(this.t >= this.sampleRate) {
        if(this._target && this._target.trigger)
          this._target.trigger()
        this.t -= this.sampleRate
      }
    }
  }

  get target() {
    return this._target
  }
  set target(target) {
    if(this._target)
      this.unChain(target)
    if(target) {
      this._target = target
      this.chainBefore(target)
    }
  }
}
module.exports = Retriggerer

},{"../Unit.js":55}],96:[function(require,module,exports){
const Unit = require("../Unit.js")

function SampleRateRedux(input, ammount) {
  Unit.call(this)
  this.addInlet("in")
  this.addInlet("ammount", {mono: true})
  this.addOutlet("out")

  this.val = [0]
  this.timeSinceLastUpdate = Infinity


  this.IN = input || 0
  this.AMMOUNT = ammount || 0
}
SampleRateRedux.prototype = Object.create(Unit.prototype)
SampleRateRedux.prototype.constructor = SampleRateRedux
module.exports = SampleRateRedux

SampleRateRedux.prototype._tick = function() {
  var chunkSize = this.OUT.chunkSize
  while(this.out.length < this.in.length)
    this.out.push( new Float32Array(chunkSize) )
  for(var t=0; t<chunkSize; t++) {
    this.timeSinceLastUpdate++
    if(this.timeSinceLastUpdate > this.ammount[t]) {
      this.val = []
      for(var c=0; c<this.in.length; c++)
        this.val[c] = this.in[c][t]
      this.timeSinceLastUpdate = 0
    }
    for(var c=0; c<this.val.length; c++) {
      this.out[c][t] = this.val[c]
    }
  }
}

},{"../Unit.js":55}],97:[function(require,module,exports){
const Unit = require("../Unit.js")
const config = require('../config.js')

function SecondsToSamples() {
  Unit.call(this)
  this.addInlet("in", {measuredIn: "s"})
  this.addOutlet("out", {measuredIn: "samples"})
}
SecondsToSamples.prototype = Object.create(Unit.prototype)
SecondsToSamples.prototype.constructor = SecondsToSamples
module.exports = SecondsToSamples

SecondsToSamples.prototype._tick = function() {
  for(var c in this.in) {
    if(this.out[c] == undefined)
      this.out[c] = new Float32Array(this.OUT.chunkSize)
    for(var t=0; t<this.in[c].length; t++)
      this.out[c][t] = this.in[c][t] * config.sampleRate
  }
}

},{"../Unit.js":55,"../config.js":122}],98:[function(require,module,exports){
const Unit = require("../Unit.js")

function SemitoneToRatio(midi) {
  Unit.call(this)
  this.addInlet("in")
  this.addOutlet("out")

  this.IN = midi || 69
}
SemitoneToRatio.prototype = Object.create(Unit.prototype)
SemitoneToRatio.prototype.constructor = SemitoneToRatio
module.exports = SemitoneToRatio

SemitoneToRatio.prototype._tick = function() {
  for(var c=0; c<this.in.length; c++) {
    var midiIn = this.in[c]
    var fOut = this.out[c] = this.out[c] || new Float32Array(this.OUT.chunkSize)

    for(var t=0; t<midiIn.length; t++)
      fOut[t] = Math.pow(2, (midiIn[t]/12))
  }
}

},{"../Unit.js":55}],99:[function(require,module,exports){
const Unit = require("../../Unit.js")
const config = require("../../config.js")
const Divide = require("../Divide.js")
const shapeTables = require("./shapeTables.js")


function Shape(shape, durationInSeconds, min, max) {
  Unit.call(this)
  this.addInlet("duration", {mono: true, type:"time", measuredIn:"s"})
  this.addInlet("min", {mono: true, type:"scalar"})
  this.addInlet("max", {mono: true, type:"scalar"})
  this.addOutlet("out", {mono: true, type:"control", min:0, max:1})

  this.t = 0

  this.playing = false
  this.leftEdge = 0
  this.rightEdge = "shape"
  this.shape = shape || "decay"
  this.DURATION = durationInSeconds || 1
  this.MIN = min || 0
  this.MAX = max || 1
}
Shape.prototype = Object.create(Unit.prototype)
Shape.prototype.constructor = Shape
module.exports = Shape

Shape.prototype._tick = function() {
  for(var t=0; t<this.out.length; t++) {

    if(this.playing)
      this.t += 1/this.duration[t]

    if(this.t <= 0) {
      if(this.leftEdge == "shape")
        this.out[t] = this.shapeTableData[0] * (this.max[t]-this.min[t]) + this.min[t]
      if(this.leftEdge.constructor == Number)
        this.out[t] = this.leftEdge * (this.max[t]-this.min[t]) + this.min[t]

    } else if(this.t > config.sampleRate) {
      if(!this.finished)
        this.finish()

      if(this.rightEdge == "shape") {
        this.out[t] = this.shapeTableData[config.sampleRate] * (this.max[t]-this.min[t]) + this.min[t]
      }
      else if(this.rightEdge.constructor == Number)
        this.out[t] = this.rightEdge * (this.max[t]-this.min[t]) + this.min[t]

    } else {
      this.out[t] =
      this.min[t] + ((this.max[t]-this.min[t])) *
        (
          this.shapeTableData[Math.ceil(this.t)] * (this.t%1) +
          this.shapeTableData[Math.floor(this.t)] * (1-this.t%1)
        )
    }
  }
}

Shape.prototype.dusp = {

  flagFunctions: {
    trigger: function() {
      this.trigger()
    },
  },

  extraArgs: function() {
    var args = []
    if(this.playing)
      args.push("trigger")
    return args
  },

  extraProperties: ["shape"],
}

/*Shape.prototype.flagFunctions = {
  trigger: function() {
    this.trigger()
  }
}
Shape.prototype.extraDuspArgs = function() {
  var args = []
  if(this.playing)
    args.push("trigger")
  return args
}
Shape.prototype.extraDuspProperties = ["shape"]*/

Shape.prototype.trigger = function() {
  this.playing = true
  this.t = 0
  return this
}
Shape.prototype.stop = function() {
  this.playing = false
}

Shape.prototype.__defineGetter__("shape", function() {
  return this._shape
})
Shape.prototype.__defineSetter__("shape", function(shape) {
  this._shape = shape
  this.shapeTable = shapeTables[shape]
  this.shapeTableData = this.shapeTable.data
  if(!this.shapeTable)
    throw this.label + ":\n\tinvalid shape function: " + shape
})

Shape.functions = { // btw: 0 >= x >= 1
  decay: function(x) {
    return 1-x
  },
  attack: function(x) {
    return x
  },
  semiSine: function(x) {
    return Math,sin(Math.PI * x)
  }
}

Shape.randomInRange = function(maxDuration, minMin, maxMax) {
  maxDuration = maxDuration || 1

  var a = minMin + Math.random() * (maxMax-minMin)
  var b = minMin + Math.random() * (maxMax-minMin)
  if(a > b) {
    var min = b
    var max = a
  } else {
    var min = a
    var max = b
  }

  return new Shape(
    Shape.randomShapeStr(),
    Math.random()*maxDuration,
    min,
    max,
  )
}

Shape.randomShapeStr = function() {
  var keys = Object.keys(shapeTables)
  return keys[Math.floor(Math.random()*keys.length)]
}

Shape.randomDecay = function(maxDuration) {
  return new Shape(
    "decaySquared",
    Math.random() * (maxDuration || 5),
  )
}

Shape.prototype.randomDecay = function(maxDuration) {
  this.shape = "decay"
  this.DURATION = Math.random() * (maxDuration || 5)
  this.MIN = 0
  this.MAX = 1
}

},{"../../Unit.js":55,"../../config.js":122,"../Divide.js":69,"./shapeTables.js":100}],100:[function(require,module,exports){
const config = require("../../config.js")

function makeTable(func, name) {
  var table = new Float32Array(config.sampleRate+1)
  var area = 0
  for(var x=0; x<table.length; x++) {
    table[x] = func(x/config.sampleRate)
    area += table[x]
  }

  area /= config.sampleRate+1

  return {
    data: table,
    name: name,
    area: area,
  }
}


module.exports = {
  decay: makeTable(
    (x) => { return 1-x },
    "decay"
  ),
  attack: makeTable(
    (x)=>{ return x },
    "attack"
  ),
  semiSine: makeTable(
    (x) => { return Math.sin(Math.PI * x) },
    "semiSine"
  ),
  decaySquared: makeTable(
    (x) => { return (1-x)*(1-x) },
    "decaySquared"
  )
}

},{"../../config.js":122}],101:[function(require,module,exports){
const Unit = require("../Unit.js")

function SignalCombiner(a, b) {
  Unit.call(this)

  this.addInlet("a")
  this.addInlet("b")
  this.addOutlet("out")

  this.A = a || 0
  this.B = b || 0
}
SignalCombiner.prototype = Object.create(Unit.prototype)
SignalCombiner.prototype.constructor = SignalCombiner
module.exports = SignalCombiner

SignalCombiner.prototype.collapseA = function() {
  var outInlets = this.OUT.connections
  for(var i in outInlets) {
    outInlets[i].connect(this.A.outlet)
  }
  this.A.disconnect()
  this.B.disconnect()
}
SignalCombiner.prototype.collapseB = function() {
  var outInlets = this.OUT.connections
  for(var i in outInlets) {
  //  console.log(this.label +".collapseB,", outInlets[i].label, ".connect(", this.B.outlet.label, ")")
    outInlets[i].connect(this.B.outlet)
  }
  this.A.disconnect()
  this.B.disconnect()
}

},{"../Unit.js":55}],102:[function(require,module,exports){
const Unit = require("../Unit.js")
const config = require("../config.js")

function Subtract(A, B) {
  Unit.call(this)
  this.addInlet("a")
  this.addInlet("b")
  this.addOutlet("out")

  this.A = A || 0
  this.B = B || 0
}
Subtract.prototype = Object.create(Unit.prototype)
Subtract.prototype.constructor = Subtract
module.exports = Subtract

const zeroChunk = new Float32Array(config.standardChunkSize).fill(0)

Subtract.prototype._tick = function() {
  for(var c=0; c<this.a.length || c<this.b.length; c++) {
    if(!this.out[c])
      this.out[c] = new Float32Array(this.OUT.chunkSize)
    var aChunk = this.a[c] || zeroChunk
    var bChunk = this.b[c] || zeroChunk
    for(var t=0; t<aChunk.length; t++) {
      this.out[c][t] = aChunk[t] - bChunk[t]
    }
  }
}

},{"../Unit.js":55,"../config.js":122}],103:[function(require,module,exports){
const SignalCombiner = require("./SignalCombiner.js")
const config = require("../config.js")
const dusp = require("../dusp")

function Sum(a, b) {
  SignalCombiner.call(this, a, b)
}
Sum.prototype = Object.create(SignalCombiner.prototype)
Sum.prototype.constructor = Sum
module.exports = Sum

Sum.prototype.dusp = {
  shorthand: function(index) {
    return "("+dusp(this.A, index) + " + " + dusp(this.B, index)+")"
  }
}

Sum.many = function(inputs) {
  if(inputs.length == 1) {
    return inputs[0]
  }
  var sums = []
  sums[0] = new Sum(inputs[0], inputs[1])

  for(var i=2; i<inputs.length; i++)
    sums[i-1] = new Sum(sums[i-2], inputs[i])

  return sums[sums.length-1]
}

const zeroChannel = new Float32Array(config.standardChunkSize).fill(0)

Sum.prototype._tick = function() {
  for(var channel=0;
      channel<this.a.length || channel<this.b.length;
      channel++) {
    var aChan = this.a[channel%this.a.length] || zeroChannel
    var bChan = this.b[channel%this.b.length] || zeroChannel
    var outChan = this.out[channel]
                = (this.out[channel] || new Float32Array(config.standardChunkSize))
    for(var t=0; t<aChan.length || t<bChan.length; t++)
      outChan[t] = aChan[t] + bChan[t]
  }
}

},{"../config.js":122,"../dusp":133,"./SignalCombiner.js":101}],104:[function(require,module,exports){
const Unit = require("../Unit.js")

/*class Timer extends Unit {
  constructor() {
    suoer()

    this.addOutlet("out", "mono")
    this.t = 0

    this.samplePeriod = 1/this.sampleRate
  }

  _tick() {
    for(var t=0; t<this.out.length; t++) {
      this.t += this.samplePeriod
      this.out[t] = this.t
    }
  }

  trigger() {
    this.t = 0
  }
}
module.exports = Timer*/

function Timer() {
  Unit.call(this)
  this.addOutlet("out", {mono: true})

  this.t = 0
  this.samplePeriod = 1/this.sampleRate
}
Timer.prototype = Object.create(Unit.prototype)
Timer.prototype.constructor = Timer
module.exports = Timer

Timer.prototype._tick = function() {
  for(var t=0; t<this.out.length; t++) {
    this.t += this.samplePeriod
    this.out[t] = this.t
  }
}

Timer.prototype.trigger = function() {
  this.t = 0
}

},{"../Unit.js":55}],105:[function(require,module,exports){
const Unit = require("../Unit.js")

// Does a pythagorus across channels

function VectorMagnitude() {
  Unit.call(this)
  this.addInlet("in") // vector
  this.addOutlet("out", {mono: true})

  this.IN = [0,0]
}
VectorMagnitude.prototype = Object.create(Unit.prototype)
VectorMagnitude.prototype.constructor = VectorMagnitude
module.exports = VectorMagnitude

VectorMagnitude.prototype._tick = function() {
  var chunkSize = this.IN.chunkSize
  var nC = this.in.length
  for(var t=0; t<chunkSize; t++) {
    var squareSum = 0
    for(var c=0; c<nC; c++) {
      var x = this.in[c][t]
      squareSum += x*x
    }
    this.out[t] = Math.sqrt(squareSum)
    //console.log(this.out[t], this.in[0][t], this.in[1][t])
  }
}

},{"../Unit.js":55}],106:[function(require,module,exports){
module.exports = {
	AHD: require("./AHD.js"),
	Abs: require("./Abs.js"),
	AllPass: require("./AllPass.js"),
	CircleBufferNode: require("./CircleBufferNode.js"),
	CircleBufferReader: require("./CircleBufferReader.js"),
	CircleBufferWriter: require("./CircleBufferWriter.js"),
	Clip: require("./Clip.js"),
	CombFilter: require("./CombFilter.js"),
	ConcatChannels: require("./ConcatChannels.js"),
	CrossFader: require("./CrossFader.js"),
	DecibelToScaler: require("./DecibelToScaler.js"),
	Delay: require("./Delay.js"),
	Divide: require("./Divide.js"),
	Filter: require("./Filter.js"),
	FixedDelay: require("./FixedDelay.js"),
	FixedMultiply: require("./FixedMultiply.js"),
	Gain: require("./Gain.js"),
	GreaterThan: require("./GreaterThan.js"),
	HardClipAbove: require("./HardClipAbove.js"),
	HardClipBelow: require("./HardClipBelow.js"),
	LessThan: require("./LessThan.js"),
	MidiToFrequency: require("./MidiToFrequency.js"),
	Monitor: require("./Monitor.js"),
	MonoDelay: require("./MonoDelay.js"),
	Multiply: require("./Multiply.js"),
	Noise: require("./Noise.js"),
	MultiChannelOsc: require("./Osc/MultiChannelOsc.js"),
	Osc: require("./Osc/Osc.js"),
	Pan: require("./Pan.js"),
	PickChannel: require("./PickChannel.js"),
	PolarityInvert: require("./PolarityInvert.js"),
	Pow: require("./Pow.js"),
	Ramp: require("./Ramp.js"),
	ReadBackDelay: require("./ReadBackDelay.js"),
	Repeater: require("./Repeater.js"),
	Rescale: require("./Rescale.js"),
	Retriggerer: require("./Retriggerer.js"),
	SampleRateRedux: require("./SampleRateRedux.js"),
	SecondsToSamples: require("./SecondsToSamples.js"),
	SemitoneToRatio: require("./SemitoneToRatio.js"),
	Shape: require("./Shape/index.js"),
	SignalCombiner: require("./SignalCombiner.js"),
	Subtract: require("./Subtract.js"),
	Sum: require("./Sum.js"),
	Timer: require("./Timer.js"),
	VectorMagnitude: require("./VectorMagnitude.js"),
	Augment: require("./spectral/Augment.js"),
	BinShift: require("./spectral/BinShift.js"),
	FFT: require("./spectral/FFT.js"),
	HardHighPass: require("./spectral/HardHighPass.js"),
	HardLowPass: require("./spectral/HardLowPass.js"),
	Hopper: require("./spectral/Hopper.js"),
	IFFT: require("./spectral/IFFT.js"),
	ReChunk: require("./spectral/ReChunk.js"),
	SpectralGate: require("./spectral/SpectralGate.js"),
	SpectralSum: require("./spectral/SpectralSum.js"),
	SpectralUnit: require("./spectral/SpectralUnit.js"),
	UnHopper: require("./spectral/UnHopper.js"),
	Windower: require("./spectral/Windower.js"),
	CircularMotion: require("./vector/CircularMotion.js"),
	LinearMotion: require("./vector/LinearMotion.js")
}
},{"./AHD.js":57,"./Abs.js":58,"./AllPass.js":59,"./CircleBufferNode.js":60,"./CircleBufferReader.js":61,"./CircleBufferWriter.js":62,"./Clip.js":63,"./CombFilter.js":64,"./ConcatChannels.js":65,"./CrossFader.js":66,"./DecibelToScaler.js":67,"./Delay.js":68,"./Divide.js":69,"./Filter.js":70,"./FixedDelay.js":71,"./FixedMultiply.js":72,"./Gain.js":73,"./GreaterThan.js":74,"./HardClipAbove.js":75,"./HardClipBelow.js":76,"./LessThan.js":77,"./MidiToFrequency.js":78,"./Monitor.js":79,"./MonoDelay.js":80,"./Multiply.js":81,"./Noise.js":82,"./Osc/MultiChannelOsc.js":83,"./Osc/Osc.js":84,"./Pan.js":87,"./PickChannel.js":88,"./PolarityInvert.js":89,"./Pow.js":90,"./Ramp.js":91,"./ReadBackDelay.js":92,"./Repeater.js":93,"./Rescale.js":94,"./Retriggerer.js":95,"./SampleRateRedux.js":96,"./SecondsToSamples.js":97,"./SemitoneToRatio.js":98,"./Shape/index.js":99,"./SignalCombiner.js":101,"./Subtract.js":102,"./Sum.js":103,"./Timer.js":104,"./VectorMagnitude.js":105,"./spectral/Augment.js":107,"./spectral/BinShift.js":108,"./spectral/FFT.js":109,"./spectral/HardHighPass.js":110,"./spectral/HardLowPass.js":111,"./spectral/Hopper.js":112,"./spectral/IFFT.js":113,"./spectral/ReChunk.js":114,"./spectral/SpectralGate.js":115,"./spectral/SpectralSum.js":116,"./spectral/SpectralUnit.js":117,"./spectral/UnHopper.js":118,"./spectral/Windower.js":119,"./vector/CircularMotion.js":120,"./vector/LinearMotion.js":121}],107:[function(require,module,exports){
const SpectralUnit = require("./SpectralUnit.js")

class Augment extends SpectralUnit {
  constructor(incrementMapping={1:1}, windowSize, hopInterval) {
    super()

    this.addSpectralInlet("in")
    this.addSpectralOutlet("out")

    this.incrementMapping = incrementMapping
  }

  _tick() {
    for(var c=0; c<this.in.length; c++) {
      var out = this.out[c] = this.out[c] || new Array(this.frameSize)
      out.fill(0)
      for(var bin=0; bin<this.windowSize; bin++) {
        for(var i in this.incrementMapping) {
          var bin2 = Math.round(bin*parseFloat(i))*2
          if(bin2 < 0 || bin2 >= this.frameSize)
            continue
          out[bin2] += this.in[c][bin*2] * this.incrementMapping[i]
          out[bin2+1] += this.in[c][bin*2+1] * this.incrementMapping[i]
        }
      }
    }
  }
}
module.exports = Augment

},{"./SpectralUnit.js":117}],108:[function(require,module,exports){
const SpectralUnit = require("./SpectralUnit.js")

class BinShift extends SpectralUnit {
  constructor(shift) {
    super()

    this.addSpectralInlet("in")
    this.addInlet("shift", {mono: true})
    this.addSpectralOutlet("out")

    this.SHIFT = shift || 0
  }

  _tick() {
    var shift = Math.round(this.shift[0]) * 2
    for(var c in this.in) {
      var out = this.out[c] = this.out[c] || new Array(this.frameSize).fill(0)
      out.fill(0)
      for(var bin=1; bin<this.frameSize && bin+shift < this.frameSize; bin+=2) {
        if(bin+shift < 0)
          continue
        out[bin+shift] = this.in[c][bin]
        out[bin+shift-1] = this.in[c][bin-1]
      }
    }
  }
}
module.exports = BinShift

},{"./SpectralUnit.js":117}],109:[function(require,module,exports){
const Unit = require("../../Unit.js")
const FFTjs = require("fft.js")

class FFT extends Unit {
  constructor(windowSize, hopSize) {
    super()
    if(!windowSize)
      throw "FFT expects window size"

    this.windowSize = windowSize
    this.frameSize = this.windowSize * 2

    this.tickInterval = hopSize
    this.addInlet("in", {chunkSize:windowSize})
    this.addOutlet("out", {chunkSize: this.frameSize, type:"spectral"})
    this.fft = new FFTjs(this.windowSize)
  }

  _tick() {
    for(var c in this.in) {
      this.out[c] = this.out[c] || new Array(this.windowSize*2)
      this.fft.realTransform(this.out[c], this.in[c])
      this.fft.completeSpectrum(this.out[c])
    }
  }
}
module.exports = FFT

},{"../../Unit.js":55,"fft.js":16}],110:[function(require,module,exports){
/*
  Spectrally implemented high pass filter.
*/

const SpectralUnit = require("./SpectralUnit.js")

class HardHighPass extends SpectralUnit {
  constructor(f) {
    super()

    this.addSpectralInlet("in")
    this.addInlet("f", {mono:true, type:"frequency"})
    this.addSpectralOutlet("out")

    this.fPerBin = this.sampleRate/this.windowSize

    this.F = f
  }

  _tick() {
    var cutOff = Math.round(this.f[0] / this.fPerBin)*2

    for(var c=0; c<this.in.length; c++) {
      this.out[c] = this.out[c] || new Array(this.frameSize)

      for(var i=0; i<cutOff && i<this.frameSize; i++)
        this.out[c][i] = 0
      for(var i=cutOff; i<this.frameSize; i++)
        this.out[c][i] = this.in[c][i]
    }
  }
}
module.exports = HardHighPass

},{"./SpectralUnit.js":117}],111:[function(require,module,exports){
/*
  Spectrally implemented low pass filter.
*/

const SpectralUnit = require("./SpectralUnit.js")

class HardLowPass extends SpectralUnit {
  constructor(f) {
    super()

    this.addSpectralInlet("in")
    this.addInlet("f", {mono:true, type:"frequency"})
    this.addSpectralOutlet("out")

    this.fPerBin = this.sampleRate/this.windowSize

    this.F = f
  }

  _tick() {
    var cutOff = Math.round(this.f[0] / this.fPerBin)*2

    for(var c=0; c<this.in.length; c++) {
      this.out[c] = this.out[c] || new Array(this.frameSize)

      for(var i=0; i<cutOff && i<this.frameSize; i++)
        this.out[c][i] = this.in[c][i]
      for(var i=cutOff; i<this.frameSize; i++)
        this.out[c][i] = 0
    }
  }
}
module.exports = HardLowPass

},{"./SpectralUnit.js":117}],112:[function(require,module,exports){
const Unit = require("../../Unit.js")
const gcd = require("compute-gcd")

class Hopper extends Unit {
  constructor(hopSize, frameSize) {
    super();
    this.addInlet("in")
    this.addOutlet("out", {chunkSize: frameSize})

    this.hopSize = hopSize
    this.frameSize = frameSize

    this.buffer = [] // multiple circular buffers
    this.t = 0
    this.tickInterval = gcd(hopSize, this.IN.chunkSize)
  }

  _tick() {
    // copy input to the circular buffer
    for(var c=0; c<this.in.length; c++) {
      var buffer = this.buffer[c] = this.buffer[c] || new Array(this.frameSize).fill(0)
      for(var t=0; t<this.tickInterval; t++)
        buffer[(this.t+t)%this.frameSize] = this.in[c][(this.t + t)%this.in[c].length]
    }

    //increment this.t
    this.t += this.tickInterval

    if(this.t%this.hopSize == 0)
      // copy output from circular buffer to output
      for(var c=0; c<this.buffer.length; c++) {
        var out = this.out[c] = this.out[c] || new Array(this.frameSize)
        var buffer = this.buffer[c]
        for(var t=0; t<this.frameSize; t++)
          out[t] = buffer[(t + this.t)%this.frameSize]
      }
  }
}
module.exports = Hopper

},{"../../Unit.js":55,"compute-gcd":13}],113:[function(require,module,exports){
const Unit = require("../../Unit.js")
const FFTjs = require("fft.js")

class IFFT extends Unit {
  constructor(windowSize, hopSize) {
    super()
    if(!windowSize)
      throw "IFFT constructor requires argument: windowSize"

    this.windowSize = windowSize
    this.frameSize = windowSize * 2
    this.fft = new FFTjs(this.windowSize)
    this.complexOut = new Array(this.frameSize) // buffer to  temporarily store complex output of ifft

    this.tickInterval = hopSize

    this.addInlet("in", {type:"spectral", chunkSize: this.frameSize})
    this.addOutlet("out", {chunkSize: this.windowSize})
  }

  _tick() {
    for(var c in this.in) {
      // make output buffer for channel if does not exist
      this.out[c] = this.out[c] || new Array(this.windowSize)

      // perform ifft
      this.fft.inverseTransform(this.complexOut, this.in[c])

      // discard imaginary part of the signal
      for(var t=0; t<this.out[c].length; t++)
        this.out[c][t] = this.complexOut[t*2]
    }
  }
}
module.exports = IFFT

},{"../../Unit.js":55,"fft.js":16}],114:[function(require,module,exports){
const Unit = require("../../Unit.js")
const gcd = require("compute-gcd")
const lcm = require("compute-lcm")

class ReChunk extends Unit {
  constructor(inputInterval, outputInterval) {
    super()
    if(!inputInterval || !outputInterval)
      throw "ReChunk expects 2 numeric contructor arguments"

    this.inputInterval = inputInterval
    this.outputInterval = outputInterval

    this.addInlet("in", {chunkSize: this.inputInterval})
    this.addOutlet("out", {chunkSize: this.outputInterval})
    console.log(this.inputInterval, this.outputInterval)
    this.tickInterval = gcd(this.inputInterval, this.outputInterval)

    this.bufferSize = lcm(this.inputInterval, this.outputInterval)
    //                  ^ is this correct??

    this.buffer = [] // multichanel circular internal buffer
    this.t = 0
  }

  _tick() {
    // copy input to internal buffer (if appropriate)
    if(this.t%this.inputInterval == 0)
      for(var c=0; c<this.in.length; c++) {
        var buffer = this.buffer[c] = this.buffer[c] || new Array(this.bufferSize).fill(0)
        for(var t=0; t<this.inputInterval; t++)
          buffer[(this.t+t)%buffer.length] = this.in[c][t]
      }

    // increment t
    this.t += this.tickInterval

    // copy internal buffer to output (if appropriate)
    if(this.t%this.outputInterval == 0) {
      var t0 = this.t-this.outputInterval
      for(var c=0; c<this.buffer.length; c++) {
        var out = this.out[c] = this.out[c] || new Array(this.outputInterval)
        var buffer = this.buffer[c]
        for(var t=0; t<this.outputInterval; t++)
          out[t] = buffer[(t0+t)%buffer.length]
      }
    }


  }
}
module.exports = ReChunk

},{"../../Unit.js":55,"compute-gcd":13,"compute-lcm":14}],115:[function(require,module,exports){
const SpectralUnit = require("./SpectralUnit.js")

class SpectralGate extends SpectralUnit {
  constructor(threshold) {
    super()
    this.addSpectralInlet("in")
    this.addInlet("threshold", {mono: true})
    this.addSpectralOutlet("out",)

    this.invert = true

    this.THRESHOLD = threshold || 0.5
  }

  _tick() {
    var threshold = this.threshold[0]
    for(var c in this.in) {
      var out = this.out[c] = this.out[c] || new Array(this.frameSize)
      for(var bin=0; bin<this.frameSize; bin+=2) {
        var re = this.in[c][bin]
        var im = this.in[c][bin+1]
        var mag = Math.sqrt(re*re + im*im)
        if(this.invert ? mag < threshold : mag > threshold) {
          out[bin] = re
          out[bin+1] = im
        } else {
          out[bin] = 0
          out[bin+1] = 0
        }
      }
    }
  }
}
module.exports = SpectralGate

},{"./SpectralUnit.js":117}],116:[function(require,module,exports){
const SpectralUnit = require("./SpectralUnit.js")

class SpectralSum extends SpectralUnit {
  constructor(a, b, windowSize, hopInterval) {
    super()

    this.addSpectralInlet("a")
    this.addSpectralInlet("b")
    this.addSpectralOutlet("out")

    this.A = a
    this.B = b
  }

  _tick() {
    var numberOfChannels = Math.max(this.a.length, this.b.length)
    for(var c=0; c<numberOfChannels; c++) {
      var a = this.a[c%this.a.length]
      var b = this.b[c%this.b.length]
      var out = this.out[c] = this.out[c] || new Array(this.frameSize)
      for(var bin=0; bin<this.frameSize; bin++)
        out[bin] = a[bin] + b[bin]
    }
  }
}
module.exports = SpectralSum

},{"./SpectralUnit.js":117}],117:[function(require,module,exports){
/*
  A base class for unit which process spectral data.
*/

const Unit = require("../../Unit.js")
const config = require("../../config")

class SpectralUnit extends Unit {
  constructor() {
    super()

    this.windowSize = config.fft.windowSize
    this.frameSize = this.windowSize * 2
    this.hopInterval = config.fft.hopSize
    this.tickInterval = this.hopInterval
  }

  addSpectralInlet(name, options={}) {
    options = Object.assign({}, options, {
      type: "spectral",
      chunkSize: this.frameSize,
    })
    this.addInlet(name, options)
  }
  addSpectralOutlet(name, options={}) {
    options = Object.assign({}, options, {
      type: "spectral",
      chunkSize: this.frameSize,
    })
    this.addOutlet(name, options)
  }
}
SpectralUnit.prototype.isSpectralUnit = true
module.exports = SpectralUnit

},{"../../Unit.js":55,"../../config":122}],118:[function(require,module,exports){
const Unit = require("../../Unit.js")

class UnHopper extends Unit {
  constructor(hopSize, windowSize) {
    super()

    this.windowSize = windowSize
    this.hopSize = hopSize

    this.tickInterval = hopSize

    this.addInlet("in", {chunkSize: this.windowSize})
    this.addOutlet("out", {chunkSize: this.hopSize})

    this.buffer = [] // multichannel circular buffer
    this.t = 0
  }

  _tick() {
    // mix input to buffer
    for(var c=0; c<this.in.length; c++) {
      var buffer = this.buffer[c] = this.buffer[c] || new Array(this.windowSize).fill(0)
      for(var t=0; t<this.windowSize; t++) {
        buffer[(t+this.t)%buffer.length] += this.in[c][t]
      }
    }
    this.t += this.hopSize

    // copy from buffer to output
    if(this.t > this.hopSize) {
      var t0 = (this.t-this.hopSize)
      var tBuffer
      for(var c=0; c<this.buffer.length; c++) {
        var out = this.out[c] = this.out[c] || new Array(this.hopSize)
        var buffer = this.buffer[c]
        for(var t=0; t<this.hopSize; t++) {
          tBuffer = (t0+t)%buffer.length
          out[t] = buffer[tBuffer]
          // wipe copied part of the buffer
          buffer[tBuffer] = 0
        }
      }
    }
  }
}
module.exports = UnHopper

},{"../../Unit.js":55}],119:[function(require,module,exports){
const Unit = require("../../Unit.js")

class Windower extends Unit {
  constructor(windowSize /*in samples*/, kind="hamming", hopSize) {
    super()
    if(!windowSize)
      throw "Windower constructor expects a windowSize"
    this.addInlet("in", {chunkSize:windowSize})
    this.addOutlet("out", {chunkSize: windowSize})
    this.tickInterval = hopSize

    this.windowSize = windowSize
    this.windowKind = kind
    this.envelopeBuffer = Windower.getEnvelope(windowSize, kind)
  }

  _tick() {
    for(var c=0; c<this.in.length; c++) {
      var out = this.out[c] = this.out[c] || new Array(this.windowSize)
      for(var t=0; t<this.windowSize; t++)
        out[t] = this.in[c][t] * this.envelopeBuffer[t]
    }
  }
}
module.exports = Windower

Windower.envelopes = {}
Windower.envelopeFunctions = {
  "hamming": (n, N) => {
    return Math.pow( Math.sin((Math.PI * n) / (N-1)) , 2 )
  }
}
Windower.windowSpectrums = {}
function getEnvelope(size, type) {
  var F = Windower.envelopeFunctions[type]
  if(!F)
    throw "Window type \'"+type+"\' is not defined."
  var name = type + size
  if(Windower.envelopes[name])
    return Windower.envelopes[name]

  var env = new Float32Array(size)
  for(var n=0; n<size; n++)
    env[n] = F(n, size)

  Windower.envelopes[name] = env
  return env
}
Windower.getEnvelope = getEnvelope

},{"../../Unit.js":55}],120:[function(require,module,exports){
const Unit = require("../../Unit.js")
const config = require('../../config.js')

const phiOverSampleRate = 2*Math.PI/config.sampleRate

function CircularMotion(f, r, centre) {
  Unit.call(this)
  this.addInlet("f", {mono: true})
  this.addInlet("radius", {mono: true})
  this.addInlet("centre", 2)
  this.addOutlet("out", 2)

  this.phase = 0
  this.F = f || 1
  this.RADIUS = r || 1
  this.CENTRE = centre || [0, 0]
}
CircularMotion.prototype = Object.create(Unit.prototype)
CircularMotion.prototype.constructor = CircularMotion
module.exports = CircularMotion

CircularMotion.prototype._tick = function() {
  for(var t=0; t<this.f.length; t++) {
    this.phase += this.f[t] * phiOverSampleRate
    this.out[0][t] = Math.sin(this.phase) * this.radius[t] + this.centre[0][t]
    this.out[1][t] = Math.cos(this.phase) * this.radius[t] + this.centre[1][t]
  }
}

CircularMotion.random = function(fMax, rMax, oMax) {
  var circ = new RotatingAmbient(
    Math.random() * (fMax || 2),
    Math.random() * (rMax || 5),
    [
      (Math.random()*2-1) * (oMax || 5),
      (Math.random()*2-1) * (oMax || 5),
    ],
  )
  circ.phase = Math.random()*2*Math.PI
  return circ
}

},{"../../Unit.js":55,"../../config.js":122}],121:[function(require,module,exports){
const Unit = require("../../Unit.js")
const config = require("../../config.js")

function LinearMotion(a, b, duration) {
  Unit.call(this)

  this.addInlet("a")
  this.addInlet("b")
  this.addInlet("duration", {mono: true})
  this.addOutlet("out")

  this.A = a || [0,0]
  this.B = b || [0,0]
  this.DURATION = duration || 1

  this.progress = 0
  this.playing = true
}
LinearMotion.prototype = Object.create(Unit.prototype)
LinearMotion.prototype.constructor = LinearMotion
module.exports = LinearMotion

LinearMotion.random = function(maxSize, maxDuration) {
  maxSize = maxSize || 10
  maxDuration = maxDuration || 10
  var motion = new LinearMotion(
    [
      (Math.random()*2-1) * maxSize,
      (Math.random()*2-1) * maxSize,
    ],
    [
      (Math.random()*2-1) * maxSize,
      (Math.random()*2-1) * maxSize,
    ],
    Math.random() * maxDuration,
  )
  return motion
}

LinearMotion.prototype._tick = function() {
  var chunkSize = this.OUT.chunkSize

  var progress = new Float32Array(chunkSize)

  for(var t=0; t<chunkSize; t++) {
    if(this.playing && this.progress>=0 && this.progress<1)
      this.progress += config.sampleInterval / this.duration[t]
    progress[t] = this.progress
  }

  for(var c=0; c<this.a.length || c<this.b.length; c++) {
    var out = this.out[c] = this.out[c] || new Float32Array(chunkSize)
    var a = this.a[c] || new Float32Array(chunkSize)
    var b = this.b[c] || new Flaot32Array(chunkSize)
    for(var t=0; t<chunkSize; t++)
      out[t] = a[t] * (1-progress[t]) + b[t] * progress[t]
  }
}

},{"../../Unit.js":55,"../../config.js":122}],122:[function(require,module,exports){
(function (process){
const argv = require("minimist")(process.argv.slice(2))

var localConfig = {}

Object.assign(localConfig, {
  standardChunkSize: 256, // if < 256, Web Audio API will prang out
  sampleRate: 44100,
  channelFormat: "stereo",

  fft: {
    windowSize: 4096,
    hopSize: 4096/4,
    windowKind: "hamming",
  },

  useDuspShorthands: true,
}, argv)


localConfig.sampleInterval = 1/module.exports.sampleRate

module.exports = localConfig

}).call(this,require('_process'))
},{"_process":206,"minimist":23}],123:[function(require,module,exports){
const RenderStream = require("./RenderStream")
const WritableWAA = require('web-audio-stream/writable')

function connectToWAA(outlet, destination) {
  // stream an outlet into a Web Audio API destination
  console.log('nc', outlet.numberOfChannels)
  if(outlet.numberOfChannels != 1)
    console.warn('streaming multichannel ('+outlet.numberOfChannels+') outlet to WAA')

  let writable = WritableWAA(destination, {
    context: destination.context,
    channels: outlet.numberOfChannels,
    sampleRate: outlet.sampleRate,
    samplesPerFrame: outlet.chunkSize,

    mode: WritableWAA.SCRIPT_MODE,

    autoend: true,
  })

  let renderStream = new RenderStream(outlet, outlet.numberOfChannels)
  renderStream.pipe(writable)
  
  return renderStream
}
module.exports = connectToWAA

},{"./RenderStream":53,"web-audio-stream/writable":44}],124:[function(require,module,exports){
function constructExpression(o, index, destinations) {
  if(o.constructor == String)
    o = parseExpression(o, index)
  if(o.constructor == String)
    throw "Can't construct expression: " + o

  switch(o.type) {
    case "object":
      return constructObject(o, index)
    case "number":
      return constructNumber(o, index)

    case "id":
      return constructObjectReference(o, index)

    case "operation":
      return constructOperation(o, index, destinations)

    case "objectProperty":
      return constructObjectProperty(o, index)

    case "shorthand":
      return constructShorthand(o, index)

    case "unnamedArgument":
      return constructExpression(o.value, index)

    case "string":
      return constructString(o, index)

    case "json":
      return o.o

    default:
      throw "Unknown expression type: " + o.type
  }
}

module.exports = constructExpression
const parseExpression = require("../parseDSP/getExpression.js")
const constructObject = require("./constructObject")
const constructNumber = require("./constructNumber")
const constructObjectReference = require("./constructObjectReference")
const constructOperation = require("./constructOperation")
const constructObjectProperty = require("./constructObjectProperty")
const constructShorthand = require("./constructShorthand")
const constructString = require("./constructString")

},{"../parseDSP/getExpression.js":140,"./constructNumber":125,"./constructObject":126,"./constructObjectProperty":127,"./constructObjectReference":128,"./constructOperation":129,"./constructShorthand":130,"./constructString":131}],125:[function(require,module,exports){
function constructNumber(o) {
  if(o.constructor == String)
    o = parseNumber(o)

  if(o.type != "number")
    return null

  return o.n
}

module.exports = constructNumber
const parseNumber = require("../parseDSP/getNumber.js")

},{"../parseDSP/getNumber.js":150}],126:[function(require,module,exports){


function constructObject(o, index) {
  index = index || {}
  if(o.constructor == String)
    o = parseObject(o)

  if(o.type != "object")
    return null

  var constructor = components[o.constructor]
  if(!constructor)
    throw "Unknown object constructor: "+o.constructor
  var args = o.arguments.map(constructExpression)

  /*var obj = Object.create(constructor.prototype)
  constructor.apply(obj, args)*/
  var obj = new constructor(...args)
  if(o.id)
    obj.label = o.id

  if(index[obj.label]) {
    if(index[obj.label] != obj)
      throw "Duplicate objects for id:", obj.label
  } else
    index[obj.label] = obj

  for(var i in o.attributes) {
    var arg = o.attributes[i]
    var property = arg.property
    var upperCaseProperty = property.toUpperCase()
    if(obj[upperCaseProperty] && obj[upperCaseProperty].isInlet)
      property = upperCaseProperty
    if(arg.type == "attribute")
      obj[property] = constructExpression(arg.value, index)
    else
      throw "unknown argument type: ", arg.type
  }

  if(obj.dusp && obj.dusp.flagFunctions)
    for(var i in o.flags) {
      var flag = o.flags[i].flag
      var func = obj.dusp.flagFunctions[flag]
      if(func)
        func.call(obj)
    }




  return obj
}

module.exports = constructObject
const parseObject = require("../parseDSP/getObject.js")
const components = require("../patchesAndComponents")
const constructExpression = require("./constructExpression")

},{"../parseDSP/getObject.js":151,"../patchesAndComponents":192,"./constructExpression":124}],127:[function(require,module,exports){
function constructObjectProperty(o, index) {
  var obj = constructExpression(o.object, index)
  return obj[o.property]
}

module.exports = constructObjectProperty
const constructExpression = require("./constructExpression")

},{"./constructExpression":124}],128:[function(require,module,exports){
function constructObjectReference(o, index) {
  if(o.constructor == String)
    o = parseObjectReference(o)

  if(index[o.id])
    return index[o.id]
  else
    throw "Error: Referencing an object which has not been declared: #"+o.id
}
module.exports = constructObjectReference

const parseObjectReference = require("../parseDSP/getObjectReference.js")

},{"../parseDSP/getObjectReference.js":153}],129:[function(require,module,exports){
function constructOperation(o, index, destinations) {
  if(!o.a || !o.b || !o.operator)
    throw "could not construct operation"

  var a = constructExpression(o.a, index)
  var b = constructExpression(o.b, index)

  switch(o.operator) {
    case "*":
      return quick.multiply(a, b)
    case "/":
      return quick.divide(a, b)
    case "+":
      return quick.add(a, b)
    case "-":
      return quick.subtract(a, b)
    case ",":
      return quick.concat(a, b)
    case "@":
      return new components.Pan(a, b)
    case "^":
      return quick.pow(a, b)
    case "->":
      if(b.isUnitOrPatch) {
        b.defaultInlet.set(a)
        return b
      } else
        throw "unknown use of -> operator"

    case "|<":
      return quick.clipBelow(b, a)

    case ">|":
      return quick.clipAbove(a, b)

    case "for":
      if(a.constructor == Number)
        a = new Repeater(a)
      if(a.scheduleFinish)
        a.scheduleFinish(b)
      else
        throw "invalid use of 'for' operator. First operand has no scheduleFinish function"
      return a

    case "then":
      var out
      if(!destinations || !destinations.length) {
        out = new Repeater
        out.IN = a
        destinations = [(x) => {
          out.IN = x
        }]
      }
      a.onFinish = () => {
        for(var i in destinations)
          destinations[i](b)
      }
      if(out)
        return out
      else
        return a

    case "at":
      if(!a.stop || !a.trigger)
        throw "invalid use of 'at' operator"
      a.stop()
      //a.trigger()
      a.scheduleTrigger(b)
      return a

    case "!":
      if(!a.stop || !a.trigger)
        throw "invalid use of '!' operator"
      a.trigger()
      new components.Retriggerer(a, b)
      return a

    default:
      throw "Unknown operator: " + o.operator;
  }
}

module.exports = constructOperation
const quick = require("../quick")
const constructExpression = require("./constructExpression")
const components = require("../components")
const Repeater = require("../components/Repeater.js")

},{"../components":106,"../components/Repeater.js":93,"../quick":193,"./constructExpression":124}],130:[function(require,module,exports){
function constructShorthand(o, index) {
  if(o.constructor == String)
    o = parseShorthand(o)

  var args = o.arguments.map(constructNumber)

  var constructor = shorthandConstructors[o.constructorAlias]
  if(constructor)
    return constructor.apply(null, args)

  constructor = components[o.constructorAlias]
  if(constructor) {
    return new constructor(...args)
  }

  throw "Unknown shorthand: " + o.constructorAlias
}

module.exports = constructShorthand
const components = require("../patchesAndComponents")
const parseShorthand = require("../parseDSP/getShorthand.js")
const constructNumber = require("./constructNumber")
const shorthandConstructors = require("./shorthandConstructors")

},{"../parseDSP/getShorthand.js":156,"../patchesAndComponents":192,"./constructNumber":125,"./shorthandConstructors":132}],131:[function(require,module,exports){
function constructString(o, index) {
  if(o.constructor == String)
    o = parseString(o)
  if(!o)
    return null

  if(o.type == "string")
    return o.string

  return null
}

module.exports = constructString
const parseString = require("../parseDSP/getString.js")

},{"../parseDSP/getString.js":158}],132:[function(require,module,exports){
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

  AP: function(delaytime, feedback) {
    return new components.AllPass(delaytime, feedback)
  },

  random: function() {
    return Math.random()
  },
}

},{"../components":106}],133:[function(require,module,exports){
// reduce things to dusp
const config = require("./config.js")

function dusp(o, index) {
  index = index || {}

  if(o === undefined)
    return undefined
  if(o === null)
    return null

  if(o === 0 || (o && o.constructor == Number))
    return o

  if(o && o.constructor == String)
    return duspString(o)

  if(o.isUnit) {
    // return a dusp representation of the unit
    if(index[o.label])
      return "#" + o.label
    else {
      index[o.label] = o

      if(config.useDuspShorthands) {
        var outputUnits = o.outputUnits
        var useShorthand = o.numberOfOutgoingConnections <= 1
        /*for(var i in outputUnits) {
          console.log("label:", outputUnits[i].label)
          if(!index[outputUnits[i].label]) {
            useShorthand = false
            break
          }
        }*/
      } else
        var useShorthand = false

      if(useShorthand)
        if(o.dusp && o.dusp.shorthand) {
          var possibleShorthand = o.dusp.shorthand.call(o, index)
          if(possibleShorthand)
            return possibleShorthand
        }

      var args = [o.constructor.name,]

      if(!useShorthand) {
        args.push("#" + o.label)
      }

      for(var i in o.inlets) {
        if(o.inlets[i].outlet)
          var value = duspOutlet(o.inlets[i].outlet, index)
        else
          var value = o.inlets[i].constant
        var attr = i.toUpperCase() + ":" + value
        args.push(attr)
      }

      if(o.dusp) {
        if(o.dusp.extraProperties)
          if(o.dusp.extraProperties.constructor == Array)
            for(var i in o.dusp.extraProperties) {
              var prop = o.dusp.extraProperties[i]
              args.push(prop + ":" + dusp(o[prop]))
            }
          else if(o.dusp.extraProperties.constructor == Object)
            for(var prop in o.dusp.extraProperties)
              if(o[prop] != o.dusp.extraProperties[prop])
                args.push(prop + ":" + dusp(o[prop]))


        if(o.dusp.extraArgs) {
          var extraArgs = o.dusp.extraArgs.call(o)
          if(extraArgs)
            args = args.concat(extraArgs)
        }
      }

      return "[" + args.join(" ") + "]"
    }
  }

  if(o.isOutlet)
    return duspOutlet(o, index)

  if(o.isInlet)
    return duspInlet(o, index)

  console.log(o.label)
  console.warn("unable to turn object to dusp: " + o)
  return null
}

module.exports = dusp
dusp.usingShorthands = config.useDuspShorthands

function duspOutlet(o, index) {
  if(o == o.unit.defaultOutlet)
    return dusp(o.unit, index)

  var obdusp = dusp(o.unit, index)
  return obdusp + "." + o.name.toUpperCase()
}

function duspInlet(inlet, index) {
  if(inlet.connected)
    return dusp(inlet.outlet, index)
  else {
    if(inlet.constant.constructor == Number)
      return inlet.constant
    if(inlet.constant.constructor == Array)
      return "(" + inlet.constant.join(",") + ")"
    else throw "strange constant: " + inlet.constant
  }
}

function duspString(str, index) {
  return "\"" + str + "\""
}

},{"./config.js":122}],134:[function(require,module,exports){
module.exports = {
  operators: [
    "->", // connect
    "at",
    "^",
    "*",
    "/",
    "@",
    "+",
    "-",
    "!",
    ",", // concat
    "->", // connect
    ">|",
    "|<",
    "for",
    "then",
  ], // the order of this list determines binding order
  units: [
    "s", "ms",
    "Hz",
  ],

  shorthandConstructors: ["O", "Z", "Sq", "A", "D", "t", "random", "LP", "AP"]
}

const components = require("../patchesAndComponents")
for(var constr in components)
  module.exports.shorthandConstructors.push(constr)

},{"../patchesAndComponents":192}],135:[function(require,module,exports){
const whitespaceRegex = /\s/
function countWhitespace(str, i0) {
  i0 = i0 || 0

  for(var i=i0; i<str.length; i++)
    if(whitespaceRegex.test(str[i]))
      continue
    else
      return i-i0
}
module.exports = countWhitespace

},{}],136:[function(require,module,exports){
function findCoordinate(str, point) {
  var col = 0
  var row = 0
  for(var i=0; i<point; i++) {
    col++
    if(str[i] == "\n")  {
      row++
      col=0
    }
  }

  return [row, col]
}
module.exports = findCoordinate

},{}],137:[function(require,module,exports){
function getArgument(str, i0) {
  var id = getObjectReference(str, i0)
  if(id) return id

  var attr = getAttribute(str, i0)
  if(attr)
    return attr

  var arg = getExpression(str, i0)
  if(arg)
    return {
      type: "unnamedArgument",
      value: arg,
      length: arg.length,
    }

  var flag = getWord(str, i0)
  if(flag)
    return {
      type:"flag",
      flag: flag,
      length: flag.length,
    }

  return null
}

module.exports = getArgument
const getObjectReference = require("./getObjectReference.js")
const getAttribute = require("./getAttribute")
const getWord = require("./getWord.js")
const getExpression = require("./getExpression")

},{"./getAttribute":138,"./getExpression":140,"./getObjectReference.js":153,"./getWord.js":159}],138:[function(require,module,exports){
const getWord = require("./getWord.js")
const countWhitespace = require("./countWhitespace")

function getAttribute(str, i0) {
  i0 = i0 || 0

  var property = getWord(str, i0)
  if(!property)
    return null

  var i1 = i0 + property.length + countWhitespace(str, i0 + property.length)

  if(str[i1] != "=" && str[i1] != ":")
    return null
  

  var i2 = i1 + 1 + countWhitespace(str, i1+1)

  var value = getExpression(str, i2)
  if(!value)
    return null

  return {
    type: "attribute",
    property: property,
    value: value,
    "length": i2-i0 + value.length
  }
}
module.exports = getAttribute

const getExpression = require("./getExpression.js")

},{"./countWhitespace":135,"./getExpression.js":140,"./getWord.js":159}],139:[function(require,module,exports){
const skipWhitespace = require("./skipWhitespace")
const getWord = require("./getWord")

function getDotProperty(str, i0) {
  var i1 = skipWhitespace(str, i0)
  if(str[i1] != ".")
    return null
  var i2 = skipWhitespace(str, i1+1)
  var property = getWord(str, i2)
  if(!property)
    return null
  return {
    type: "property",
    property: property,
    "length": i2-i0 + property.length,
  }
}
module.exports = getDotProperty

},{"./getWord":159,"./skipWhitespace":161}],140:[function(require,module,exports){
function getExpression(str, i0) {
  i0 = i0 || 0

  var i1 = i0
  /*if(str[i0] == "(") {
    var bracketed = true
    i1++
  } else
    var bracketed = false*/

  var expr0 = getSimpleExpression(str, i1)
  if(expr0 == null)
    return null

  var iN = i1 + expr0.length
  var oList = [expr0]
  while(true) {
    //iN = skipWhitespace(str, iN)
    var op = getOperatorOperand(str, skipWhitespace(str, iN))
    if(op) {
      oList.push(op)
      iN = skipWhitespace(str, iN) + op.length
    } else break
  }

  /*if(bracketed) {
    if(str[iN] == ")")
      iN++
    else
      return null
  }*/

  var length = iN-i0
  for(var i in oList)
    delete oList[i].length

  while(oList.length > 1){
    for(var i=1; i<oList.length; i++){
      if(i == oList.length-1 || oList[i].bindingOrder < oList[i+1].bindingOrder) {
        if(i > 1) {
          oList[i].a = oList[i-1].b
          oList[i-1].b = oList[i]
          oList.splice(i, 1)
          break
        } else {
          oList[i].a = oList[i-1]
          oList[i-1] = oList[i]
          oList.splice(i, 1)
          break
        }
      }
    }
  }

  oList[0].length = length
  return oList[0]
}

function getSimpleExpression(str, startIndex) {
  startIndex = startIndex || 0


  if(str[startIndex] == "{")
    return getJSON(str, startIndex)

  if(str[startIndex] == "(") {
    var i = skipWhitespace(str, startIndex+1)
    var expr = getExpression(str, i)
    if(!expr)
      return null
    i = skipWhitespace(str, i + expr.length)
    if(str[i] != ")")
      return null
    expr.length = i+1-startIndex
    expr.bracketed = true
    return expr
  }

  var ref = getObjectReference(str, startIndex)
  if(ref)
    return ref

  var n = getNumber(str, startIndex)
  if(n)
    return n

  var obj = getObjectOrObjectProperty(str, startIndex)
  if(obj)
    return obj

  var shorthand = getShorthand(str, startIndex)
  if(shorthand)
    return shorthand

  var string = getString(str, startIndex)
  if(string)
    return string

  return null
}

module.exports = getExpression
module.exports.simple = getSimpleExpression
const getObjectOrObjectProperty = require("./getObjectOrObjectProperty")
const getObjectReference = require("./getObjectReference.js")
const getNumber = require("./getNumber.js")
const skipWhitespace = require("./skipWhitespace")
const getOperatorOperand = require("./getOperatorOperand")
const getShorthand = require("./getShorthand")
const getString = require("./getString")
const getJSON = require("./getJSON")

},{"./getJSON":148,"./getNumber.js":150,"./getObjectOrObjectProperty":152,"./getObjectReference.js":153,"./getOperatorOperand":155,"./getShorthand":156,"./getString":158,"./skipWhitespace":161}],141:[function(require,module,exports){
arguments[4][136][0].apply(exports,arguments)
},{"dup":136}],142:[function(require,module,exports){
function getArray(str, i0=0) {
  if(str[i0] != "[")
    return null

  var i = skipWhitespace(str, i0+1)

  var array = []
  while(i<str.length) {
    if(str[i] == "]") {
      i++
      break
    }

    var obj = getJSON(str, i)
    if(!obj)
      return null
    array.push(obj.o)

    i = skipWhitespace(str, i + obj.length)

    if(str[i] == ",") {
      i = skipWhitespace(str, i+1)
      continue
    } else if(str[i] == "]"){
      i++
      break
    } else
      return null
  }

  return {
    type: "json",
    o: array,
    length: i-i0
  }
}

module.exports = getArray
const skipWhitespace = require("./skipWhitespace")
const getJSON = require("./index.js")

},{"./index.js":148,"./skipWhitespace":149}],143:[function(require,module,exports){
const numberRegex = /[0-9.\-]/

function getNumber(str, startIndex=0) {

  for(var i=startIndex; i<=str.length; i++) {
    var c = str[i]
    if(!numberRegex.test(c))
      if(i==startIndex)
        return null
      else
        return {
          type: "number",
          n: parseFloat(str.slice(startIndex, i)),
          "length": i-startIndex,
        }
  }

  console.warn(
    "WARNING: open ended word",
    "\'"+str.slice(startIndex, i)+"\'",
    "at", findCoordinate(str, i)
  )
  return {
    type: "number",
    n: parseFloat(str.slice(startIndex, i)),
    "length": i-startIndex,
  } 
}

module.exports = getNumber
const findCoordinate = require("./findCoordinate")

},{"./findCoordinate":141}],144:[function(require,module,exports){
function getObject(str, i0=0) {
  if(str[i0] != "{")
    return null

  var i = skipWhitespace(str, i0+1)

  var o = {}
  while(i < str.length) {
    if(str[i] == "}") {
      i++
      break
    }
    var property = getProperty(str, i)
    if(!property)
      return null
    o[property.name] = property.value

    i = skipWhitespace(str, i + property.length)

    if(str[i] == ",") {
      i = skipWhitespace(str, i+1)
      continue
    } else if(str[i] == "}") {
      i++
      break
    } else
      return null
  }

  return {
    type: "json",
    o: o,
    length: i-i0,
  }
}

module.exports = getObject
const getProperty = require("./getProperty")
const skipWhitespace = require("./skipWhitespace.js")

},{"./getProperty":145,"./skipWhitespace.js":149}],145:[function(require,module,exports){
function getProperty(str, i0=0) {
  var name = getWord(str, i0) || getString(str, i0) || getNumber(str, i0)
  if(!name)
    return null

  var i = skipWhitespace(str, i0 + name.length)

  if(str[i] == ",")
    return {
      type: "json-property",
      name: name.string || name.n || name,
      value: true,
      length: name.length,
    }

  if(str[i] != ":")
    return null
  else
    i = skipWhitespace(str, i+1)

  var value = getJSON(str, i)
  if(!value)
    return null

  return {
    type: "json-property",
    name: name.string || name,
    value: value.o,
    length: i+value.length - i0
  }
}

module.exports = getProperty
const getWord = require("./getWord.js")
const getString = require("./getString")
const getJSON = require("./index.js")
const skipWhitespace = require("./skipWhitespace")
const getNumber = require("./getNumber")

},{"./getNumber":143,"./getString":146,"./getWord.js":147,"./index.js":148,"./skipWhitespace":149}],146:[function(require,module,exports){
function getString(str, i0=0) {

  if(str[i0] == "\"")
    var endChar = "\""
  else if(str[i0] == "'")
    var endChar = "'"
  else
    return null

  var i1
  do {
    i1 = str.indexOf(endChar, i0+1)
    if(i1 == -1)
      return null
  } while(str[i1-1] == "\\")

  return {
    type: "string",
    string: str.slice(i0+1, i1),
    length: i1-i0+1
  }
}

module.exports = getString

},{}],147:[function(require,module,exports){

const findCoordinate = require("./findCoordinate")
const wordRegex = /[a-zA-Z_]/

function getWord(str, startIndex) {
  startIndex = startIndex || 0

  for(var i=startIndex; i<str.length; i++) {
    var c = str[i]
    if(!wordRegex.test(c))
      if(i==startIndex)
        return null
      else
        return str.slice(startIndex, i)
  }
  console.warn(
    "WARNING: open ended word",
    "\'"+str.slice(startIndex, i)+"\'",
    "at", findCoordinate(str, i)
  )
  return str.slice(startIndex, i)
}
module.exports = getWord

},{"./findCoordinate":141}],148:[function(require,module,exports){
function getJSON(str, i0=0) {
  var string = getString(str, i0)
  if(string)
    return {
      type: "json",
      o: string.string,
      length: string.length
    }

  var number = getNumber(str, i0)
  if(number)
    return {
      type: "json",
      o: number.n,
      length: number.length
    }

  var array = getArray(str, i0)
  if(array)
    return array

  var obj = getObject(str, i0)
  if(obj)
    return obj


  return null
}

module.exports = getJSON
const getString = require("./getString")
const getNumber = require("./getNumber")
const getArray = require("./getArray")
const getObject = require("./getObject")

},{"./getArray":142,"./getNumber":143,"./getObject":144,"./getString":146}],149:[function(require,module,exports){
const whitespaceRegex = /\s/
function skipWhitespace(str, i0) {
  i0 = i0 || 0

  for(var i=i0; i<str.length; i++)
    if(whitespaceRegex.test(str[i]))
      continue
    else
      return i
  return i
}
module.exports = skipWhitespace

},{}],150:[function(require,module,exports){
const numberRegex = /[0-9.\-]/

function getNumber(str, startIndex) {
  startIndex = startIndex || 0

  for(var i=startIndex; i<=str.length; i++) {
    var c = str[i]
    if(!numberRegex.test(c))
      if(i==startIndex)
        return null
      else
        return {
          type: "number",
          n: parseFloat(str.slice(startIndex, i)),
          "length": i-startIndex,
        }
  }
}
module.exports = getNumber

},{}],151:[function(require,module,exports){
function getObject(str, i0) {
  i0 = i0 || 0
  if(str[i0] != "[")
    return null

  var i1 = skipWhitespace(str, i0+1)

  var constructor = getWord(str, i1)
  if(!constructor)
    return null

  var obj = {
    type: "object",
    constructor: constructor,
    arguments: [],
    flags: [],
    attributes: [],
  }

  var iN = i1 + constructor.length
  do {
    if(str[iN] == "]") {
      obj.length = iN-i0 + 1
      return obj
    }

    if(countWhitespace(str, iN)) {
      iN = skipWhitespace(str, iN)
      if(str[iN] == "]") {
        obj.length = iN-i0 + 1
        return obj
      }

      var arg = getArgument(str, iN)
      if(!arg)
        return null

      switch(arg.type) {
        case "id":
          obj.id = arg.id
          break;

        case "attribute":
          obj.attributes.push(arg)
          break;

        case "unnamedArgument":
          obj.arguments.push(arg)
          break;

        case "flag":
          obj.flags.push(arg)
          break;

        default:
          return null;
      }
      iN += arg.length
    } else
      return null

  } while(iN < str.length)

  return null
}

module.exports = getObject
const skipWhitespace = require("./skipWhitespace.js")
const getWord = require("./getWord")
const getArgument = require("./getArgument")
const countWhitespace = require("./countWhitespace")

},{"./countWhitespace":135,"./getArgument":137,"./getWord":159,"./skipWhitespace.js":161}],152:[function(require,module,exports){
function getObjectOrObjectProperty(str, i0) {
  i0 = i0 || 0
  var object = getObject(str, i0)
  if(!object)
    object = getObjectReference(str, i0)
  if(!object)
    object = getShorthand(str, i0)
  if(!object)
    return null

  var i1 = i0 + object.length
  var property = getDotProperty(str, i1)
  if(property)
    return {
      type: "objectProperty",
      property: property.property,
      object: object,
      "length": object.length + property.length,
    }
  else
    return object
}

module.exports = getObjectOrObjectProperty
const getObject = require("./getObject")
const getDotProperty = require("./getDotProperty")
const getObjectReference = require("./getObjectReference")
const getShorthand = require("./getShorthand")

},{"./getDotProperty":139,"./getObject":151,"./getObjectReference":153,"./getShorthand":156}],153:[function(require,module,exports){
const getWordWithDigits = require("./getWordWithDigits.js")

function getObjectReference(str, startIndex) {
  startIndex = startIndex || 0

  if(str[startIndex] != "#")
    return null

  var ref = getWordWithDigits(str, startIndex+1)
  if(ref)
    return {
      id: ref,
      "length": ref.length+1,
      type: "id",
    }
  else
    return null
}
module.exports = getObjectReference

},{"./getWordWithDigits.js":160}],154:[function(require,module,exports){
function getOperator(str, i0=0) {
  var winner = ""
  for(var i in operators) {
    var operator = getSpecific(operators[i], str, i0)
    if(operator && operator.length > winner.length)
      winner = operator
  }
  if(winner.length)
    return winner
  else
    return null
}

module.exports = getOperator
const {operators} = require("./config")
const getSpecific = require("./getSpecific")

},{"./config":134,"./getSpecific":157}],155:[function(require,module,exports){
function getOperatorOperand(str, i0) {
  i0 = i0 || 0

  var i1 = i0
  var operator = getOperator(str, i0)//str[i1]
  var bindingOrder = config.operators.indexOf(operator)
  if(bindingOrder == -1)
    return null

  var i2 = skipWhitespace(str, i1+operator.length)

  var b = getExpression.simple(str, i2)
  if(!b)
    return null

  return {
    type: "operation",
    operator: operator,
    b: b,
    bindingOrder: bindingOrder,
    "length": i2-i0 + b.length,
  }
}

module.exports = getOperatorOperand
const getExpression = require("./getExpression.js")
const skipWhitespace = require("./skipWhitespace.js")
const config = require("./config")
const getOperator = require("./getOperator")

},{"./config":134,"./getExpression.js":140,"./getOperator":154,"./skipWhitespace.js":161}],156:[function(require,module,exports){
function getShorthand(str, i0) {
  i0 = i0 || 0
  var constr = getWord(str, i0)
  if(!constr || config.shorthandConstructors.indexOf(constr) == -1)
    return null

  var i = i0 + constr.length
  var args = []

  var n = getNumber(str, i)
  if(n) {
    args.push(n)
    i += n.length
    while(str[i] == ",") {
      i++
      var n = getNumber(str, i)
      if(!n)
        return null
      else {
        args.push(n)
        i += n.length
        continue
      }
    }
  }

  return {
    type: "shorthand",
    constructorAlias: constr,
    arguments: args,
    length: i-i0
  }
}

module.exports = getShorthand
const getWord = require("./getWord")
const getNumber = require("./getNumber")
const config = require("./config")

},{"./config":134,"./getNumber":150,"./getWord":159}],157:[function(require,module,exports){
function getSpecific(searchStr, str, i0) {
  i0 = i0 || 0
  for(var i=0; i<searchStr.length; i++)
    if(str[i + i0] != searchStr[i])
      return null

  return searchStr
}
module.exports = getSpecific

},{}],158:[function(require,module,exports){
function getString(str, i0) {
  i0 = i0 || 0

  if(str[i0] == "\"")
    var endChar = "\""
  else if(str[i0] == "'")
    var endChar = "'"
  else
    return null

  var i1
  do {
    i1 = str.indexOf(endChar, i0+1)
    if(i1 == -1)
      return null
  } while(str[i1-1] == "\\")

  return {
    type: "string",
    string: str.slice(i0+1, i1),
    length: i1-i0+1
  }
}

module.exports = getString

},{}],159:[function(require,module,exports){
arguments[4][147][0].apply(exports,arguments)
},{"./findCoordinate":136,"dup":147}],160:[function(require,module,exports){

const wordRegex = /[a-zA-Z0-9_]/

function getWordWithDigits(str, startIndex) {
  startIndex = startIndex || 0

  for(var i=startIndex; i<=str.length; i++) {
    var c = str[i]
    if(!wordRegex.test(c))
      if(i==startIndex)
        return null
      else
        return str.slice(startIndex, i)
  }
}
module.exports = getWordWithDigits

},{}],161:[function(require,module,exports){
arguments[4][149][0].apply(exports,arguments)
},{"dup":149}],162:[function(require,module,exports){
const Patch = require("../Patch.js")
const AllPass = require("../components/AllPass.js")

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
module.exports = APStack

},{"../Patch.js":51,"../components/AllPass.js":59}],163:[function(require,module,exports){
const Patch = require("../Patch")
const AttenuationMatrix = require("./AttenuationMatrix.js")
const AllPass = require("../components/AllPass.js")

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
module.exports = APWeb

},{"../Patch":51,"../components/AllPass.js":59,"./AttenuationMatrix.js":164}],164:[function(require,module,exports){
const Patch = require("../Patch.js")
const Mixer = require("./Mixer.js")

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
module.exports = AttenuationMatrix

},{"../Patch.js":51,"./Mixer.js":176}],165:[function(require,module,exports){
const Patch = require("../Patch.js")
const Filter = require("../components/Filter.js")

class BandFilter extends Patch {
  constructor(input, fLow, fHigh) {
    super()

    this.addUnits(
      this.lowPass = new Filter(input, fHigh, "LP"),
      this.highPass = new Filter(this.lowPass.OUT, fLow, "HP")
    )
    this.highPass.kind = "HP"
    console.log(this.highPass)

    this.aliasInlet(this.lowPass.IN)
    this.aliasInlet(this.lowPass.F, "fHigh")
    this.aliasInlet(this.highPass.F, "fLow")
    this.aliasOutlet(this.highPass.OUT)
  }
}
module.exports = BandFilter

},{"../Patch.js":51,"../components/Filter.js":70}],166:[function(require,module,exports){
const Patch = require("../Patch.js")
const Shape = require("../components/Shape")
const Osc = require("../components/Osc")
const Multiply = require("../components/Multiply.js")

class Boop extends Patch {
  constructor(f, duration) {
    super()
    this.addUnits(
      this.osc = new Osc(f),
      this.envelope = new Shape("decay", duration).trigger(),
      this.mult = new Multiply(this.osc, this.envelope)
    )

    this.envelope.onFinish = () => {
      this.finish()
    }

    this.aliasOutlet(this.mult.OUT)
  }

  trigger() {
    this.envelope.trigger()
  }
  stop() {
    this.envelope.stop()
  }
}
module.exports = Boop

},{"../Patch.js":51,"../components/Multiply.js":81,"../components/Osc":85,"../components/Shape":99}],167:[function(require,module,exports){
const Patch = require("../Patch.js")
const CircularMotion = require("../components/vector/CircularMotion.js")
const Multiply = require("../components/Multiply.js")
const Repeater = require("../components/Repeater.js")

function ComplexOrbit( frequencyRatios, radiusRatios, centre) {
  Patch.call(this)

  var n
  frequencyRatios = frequencyRatios || 4
  if(frequencyRatios.constructor == Number) {
    n = frequencyRatios
    radiusRatios = []
    for(var i=0; i<n; i++)
      frequencyRatios[i] = Math.random()
  }
  n = frequencyRatios.length

  this.addUnits(
    this.frequencyRepeater = new Repeater(),
    this.radiusRepeater = new Repeater(),
  )

  radiusRatios = radiusRatios || []
  if(radiusRatios.constructor == Number) {
    var rMax = radiusRatios
    radiusRatios = []
  } else
    rMax = 1
  var current, last
  this.circs = []
  for(var i=0; i<n; i++) {
    radiusRatios[i] = radiusRatios[i] || rMax * Math.random()

    current = new CircularMotion()
    current.CENTRE = last ? last.OUT : [0,0];
    current.F = new Multiply(frequencyRatios[i], this.frequencyRepeater)
    current.RADIUS = new Multiply(radiusRatios[i], this.radiusRepeater)
    current.phase = Math.random() * Math.PI * 2

    this.circs[i] = current
    this.addUnit(current)
    last = current
  }

  this.frequencyRatios = frequencyRatios
  this.radiusRatios = radiusRatios

  this.aliasInlet(this.circs[0].CENTRE)
  this.aliasInlet(this.frequencyRepeater.IN, "f")
  this.aliasInlet(this.radiusRepeater.IN, "r")
  this.aliasOutlet(last.OUT)


  this.CENTRE = centre || [0,0]
  this.F = 1
  this.R = 1
}
ComplexOrbit.prototype = Object.create(Patch.prototype)
ComplexOrbit.prototype.constructor = ComplexOrbit
module.exports = ComplexOrbit

ComplexOrbit.random = function(n, fMax, rMax, oMax) {
  n = n || 5
  fMax = fMax || 1
  rMax = rMax || 1
  oMax = oMax || 0

  var radiusRatios = []
  var frequencyRatios = []
  for(var i=0; i<n; i++) {
    radiusRatios[i] = Math.random()*rMax
    frequencyRatios[i] = Math.random()*fMax
  }
  var centre = [
    oMax * (Math.random()*2-1),
    oMax * (Math.random()*2-1),
  ]

  return new ComplexOrbit( frequencyRatios, radiusRatios, centre)
}

},{"../Patch.js":51,"../components/Multiply.js":81,"../components/Repeater.js":93,"../components/vector/CircularMotion.js":120}],168:[function(require,module,exports){
const Patch = require("../Patch")
const CircleBuffer = require("../CircleBuffer.js")
const CircleBufferReader = require("../components/CircleBufferReader.js")
const CircleBufferWriter = require("../components/CircleBufferWriter.js")
const quick = require("../quick.js")

class DelayMixer extends Patch {
  constructor(nChannels, maxDelay) {
    super()

    if(!nChannels || !maxDelay)
      throw "DelayMixer requires constructor arguments: (nChannels, maxDelay)"

    this.buffer = new CircleBuffer(nChannels, maxDelay)

    this.addUnits(
      this.outReader = new CircleBufferReader(this.buffer)
    )
    this.outReader.postWipe = true

    this.aliasOutlet(this.outReader.OUT)
  }

  addInput(input, delay, attenuation) {
    var writer = new CircleBufferWriter(this.buffer, delay)
    writer.t = this.outReader.t
    this.outReader.chain(writer)
    this.addUnits(writer)

    if(attenuation)
      writer.IN = quick.multiply(input, attenuation)
    else
      writer.IN = input
  }
}
module.exports = DelayMixer

},{"../CircleBuffer.js":46,"../Patch":51,"../components/CircleBufferReader.js":61,"../components/CircleBufferWriter.js":62,"../quick.js":193}],169:[function(require,module,exports){
const Patch = require("../Patch.js")
const Repeater = require("../components/Repeater.js")

const Osc = require("../components/Osc/MultiChannelOsc")
const SemitoneToRatio = require("../components/SemitoneToRatio.js")
const Multiply = require("../components/Multiply.js")

function FMOsc(f) {
  Patch.call(this)

  this.addUnits(
    this.fRepeater = new Repeater(),
    this.osc = new Osc(this.fRepeater),
  )

  this.osc.randomPhaseFlip()

  this.aliasInlet(this.fRepeater.IN, "f")
  this.aliasOutlet(this.osc.OUT)

  this.F = f || 440
}
FMOsc.prototype = Object.create(Patch.prototype)
FMOsc.prototype.constructor = FMOsc
module.exports = FMOsc

FMOsc.prototype.isFMOsc = true

FMOsc.prototype.addModulator = function(modulator, ammount) {
  ammount = ammount || 1

  var multiply1 = new Multiply(modulator, ammount)
  var m2f = new SemitoneToRatio(multiply1)
  var multiply2 = new Multiply(m2f, this.osc.F.outlet)

  this.addUnits(
    multiply1,
    multiply2,
    m2f,
  )

  this.osc.F = multiply2
}

FMOsc.prototype.addModulatorOsc = function(f, ammount) {
  this.addModulator(
    new FMOsc(f),
    ammount,
  )
}

FMOsc.prototype.clearModulation = function() {
  this.osc.F = this.fRepeater
}

FMOsc.prototype.resetPhase = function() {
  this.osc.resetPhase()
}

},{"../Patch.js":51,"../components/Multiply.js":81,"../components/Osc/MultiChannelOsc":83,"../components/Repeater.js":93,"../components/SemitoneToRatio.js":98}],170:[function(require,module,exports){

const Synth = require("./Synth.js")
const unDusp = require("../unDusp")
const dusp = require("../dusp")

const quick = require("../quick.js")
const Osc = require("../patches/FMOsc")
const FrequencyGroup = require("./FrequencyGroup.js")
const StereoDetune = require("./StereoDetune.js")
const Mixer = require("./Mixer.js")
const Shape = require("../components/Shape")
const Worm = require("./Worm.js")

class FMSynth extends Synth {
  constructor(seed) {
    super()
    console.warn("FMSynth will not work until unDusp has been reimplemented")
    this.resetOscsOnTrigger = seed.resetOscsOnTrigger || true

    // unDusp the seed
    var unduspIndex = {}
    var fundamental = unDusp(seed.fundamental, unduspIndex)
    var globalModulation = unDusp(seed.mod || 1, unduspIndex)
    var envelopes = (seed.envelopes || []).map(env => unDusp(env, unduspIndex))
    var oscSeeds = seed.oscs.map(osc => {return {
      h: unDusp(osc.h, unduspIndex),
      stereoDetune: unDusp(osc.stereoDetune || 0, unduspIndex),
      modulation: (osc.modulation || []).map(attenuation => unDusp(attenuation, unduspIndex)),
      mix: unDusp(osc.mix || 0, unduspIndex)
    }})


    // make a dusp version of the seed
    var duspIndex = {}
    this.seed = {
      fundamental: dusp(fundamental, duspIndex),
      mod: dusp(globalModulation, duspIndex),
      oscs: oscSeeds.map(osc => {
        var oscSeed = {
          h: dusp(osc.h, duspIndex),
        }
        if(osc.stereoDetune)
          oscSeed.stereoDetune = dusp(osc.stereoDetune, duspIndex)
        if(osc.mix)
          oscSeed.mix = dusp(osc.mix, duspIndex)
        if(osc.modulation && osc.modulation.length)
          oscSeed.modulation = osc.modulation.map(attenuation => dusp(attenuation, duspIndex))
        return oscSeed
      }),
      resetOscsOnTrigger: this.resetOscsOnTrigger,
    }
    if(envelopes.length)
      this.seed.envelopes = envelopes.map(env => dusp(env, duspIndex))

    if(dusp.usingShorthands)
      console.warn("Possible unDusping errors with this seed, multiple references to the envelopes which may be shorthanded")


    for(var i in envelopes)
      this.addEnvelope(envelopes[i])

    var fGroup = new FrequencyGroup(fundamental)
    for(var i in oscSeeds)
      fGroup.addHarmonic(oscSeeds[i].h)


    var oscs = []
    for(var i=0; i<oscSeeds.length; i++) {
      if(oscSeeds[i].stereoDetune)
        oscs[i] = new Osc(
          new StereoDetune(fGroup.fOuts[i+1], oscSeeds[i].stereoDetune)
        )
      else
        oscs[i] = new Osc(fGroup.fOuts[i+1])
    }


    for(var carrier in oscSeeds)
      if(oscSeeds[carrier].modulation)
        for(var modulator in oscSeeds[carrier].modulation) {
          var ammount = oscSeeds[carrier].modulation[modulator]
          if(ammount) {
            oscs[carrier].addModulator(oscs[modulator], quick.multiply(ammount, globalModulation))
          }
        }

    var mixer = new Mixer()
    for(var i in oscs) {
      if(oscSeeds[i].mix)
        mixer.addInput(quick.multiply(oscs[i], oscSeeds[i].mix))
    }

    this.oscs = oscs
    this.addUnits(fGroup, oscs, mixer)

    this.aliasOutlet(mixer.OUT, "OUT")
    this.aliasInlet(fGroup.F, "F")
  }

  _trigger(p) {
    this.F = quick.pToF(p)
    if(this.resetOscsOnTrigger)
      for(var i in this.oscs)
        this.oscs[i].resetPhase()
  }

  static randomSeed({
    f = 50,
    duration = 1,
    nOscs = 8,
    pConnection = 0.1,
    maxModulationAmmount = 6,
    pMix = 0.5,
    maxStereoDetune = 1/2,
  }) {
    nOscs = nOscs || 4

    var oscs = []
    var envelopes = []
    for(var i=0; i<nOscs; i++) {
      var osc = {
        h: Math.ceil(Math.random()*32),
        modulation: [],
      //  stereoDetune: Math.random() * maxStereoDetune,
      }
      if(Math.random() < pMix) {
        var envelope = Shape.randomDecay(duration, 0, 1)
        envelopes.push(envelope)
        osc.mix = quick.multiply(envelope, Math.random())
      }
      for(var j=0; j<nOscs; j++) {
        if(Math.random() < pConnection) {
          var envelope = Shape.randomInRange(duration, 0, 1)
          envelopes.push(envelope)
          osc.modulation.push(envelope, quick.multiply(Math.random(), maxModulationAmmount))
        }
      }
      oscs.push(osc)
    }

    return {
      fundamental: f,
      oscs: oscs,
      envelopes: envelopes,
    }
  }

  static wormSeed({
    f = 50,
    nOscs = 8,
    pConnection = 0.1,
    maxModulationAmmount = 6,
    pMix = 0.5,
    maxStereoDetune = 1/2,
    maxHarmonic = 16,
    maxWormFrequency = 5
  }) {
    nOscs = nOscs || 4

    var oscs = []
    var envelopes = []
    for(var i=0; i<nOscs; i++) {
      var osc = {
        h: Math.ceil(quick.multiply(Math.random(), maxHarmonic)),
        modulation: [],
        stereoDetune: Math.random() * maxStereoDetune,
      }
      if(Math.random() < pMix) {
        var envelope = Math.random()//Worm.random()
        envelopes.push(envelope)
        osc.mix = quick.multiply(envelope, Math.random())
      }
      for(var j=0; j<nOscs; j++) {
        if(Math.random() < pConnection) {
          var envelope = Worm.random(maxWormFrequency)
          envelopes.push(envelope)
          osc.modulation.push(envelope, quick.multiply(Math.random(), maxModulationAmmount))
        }
      }
      oscs.push(osc)
    }

    return {
      fundamental: f,
      oscs: oscs,
      envelopes: envelopes,
    }
  }
}
module.exports = FMSynth

},{"../components/Shape":99,"../dusp":133,"../patches/FMOsc":169,"../quick.js":193,"../unDusp":194,"./FrequencyGroup.js":171,"./Mixer.js":176,"./StereoDetune.js":186,"./Synth.js":188,"./Worm.js":190}],171:[function(require,module,exports){
const Patch = require("../Patch.js")
const Repeater = require("../components/Repeater.js")
const quick = require("../quick.js")

function FrequencyGroup(f) {
  Patch.call(this)

  this.addUnits(
    this.fundamentalRepeater = new Repeater(f || 440, "Hz")
  )

  this.fOuts = [this.fundamentalRepeater.OUT]

  this.alias(this.fundamentalRepeater.IN, "f")

  //this.F = f || 440
}
FrequencyGroup.prototype = Object.create(Patch.prototype)
FrequencyGroup.prototype.constructor = FrequencyGroup
module.exports = FrequencyGroup

FrequencyGroup.prototype.addHarmonic = function(ratio) {
  var harmonic = quick.mult(this.fOuts[0], ratio)
  this.fOuts.push(
    harmonic,
  )
  return harmonic
}
FrequencyGroup.prototype.addRandomHarmonic = function(maxNum, maxDenom) {
  maxNum = maxNum || 8
  maxDenom = maxDenom || 8
  var numerator = Math.ceil(Math.random() * maxNum)
  var denominator = Math.ceil(Math.random()*maxDenom)
  return this.addHarmonic(numerator/denominator)
}
FrequencyGroup.prototype.addRandomHarmonics = function(n, maxNum, maxDenom) {
  n = n || 1
  var harmonicsAdded = []
  for(var i=0; i<n; i++)
    harmonicsAdded[i] = this.addRandomHarmonic(maxNum, maxDenom)
  return harmonicsAdded
}

},{"../Patch.js":51,"../components/Repeater.js":93,"../quick.js":193}],172:[function(require,module,exports){
/*
  A spectrally implemented band pass filter with sqaure attenuation curves.
*/


const Patch = require("../Patch.js")

const HardLP = require("../components/spectral/HardLowPass.js")
const HardHP = require("../components/spectral/HardHighPass.js")


class HardBandPass extends Patch {
  constructor(input, low, high) {
    super()

    this.addUnits(
      this.lp = new HardLP(low),
      this.hp = new HardHP(high),
    )

    this.hp.IN = this.lp.OUT

    this.aliasInlet(this.lp.IN, "in")
    this.aliasInlet(this.hp.F, "low")
    this.aliasInlet(this.lp.F, "high")
    this.aliasOutlet(this.hp.OUT)

    this.IN = input || 0
    console.log("low:", low)
    this.LOW = low || 0
    this.HIGH = high || 22000
  }
}
module.exports = HardBandPass

},{"../Patch.js":51,"../components/spectral/HardHighPass.js":110,"../components/spectral/HardLowPass.js":111}],173:[function(require,module,exports){
const Patch = require("../Patch.js")
const Osc = require("../components/Osc")
const Multiply = require("../components/Multiply.js")
const Sum = require("../components/Sum.js")

function LFO(frequency, amplitude, origin, waveform) {
  Patch.call(this)

  var osc1 = new Osc()
  this.alias(osc1.F)
  this.osc = osc1

  var mult1 = new Multiply(osc1.OUT)
  this.alias(mult1.B, "a")

  var location = new Sum(mult1.OUT)
  this.alias(location.B, "o")
  this.alias(location.OUT)

  this.addUnits(
    osc1, mult1, location
  )

  this.F = frequency || 1
  this.A = amplitude || 1/2
  this.O = origin || 1/2
  this.waveform = waveform || "sine"
}
LFO.prototype = Object.create(Patch.prototype)
LFO.prototype.constructor = LFO
module.exports = LFO

LFO.randomInRange = function(maxF, minMin, maxMax, waveform) {
  var a = minMin + (maxMax-minMin) * Math.random()
  var b = minMin + (maxMax-minMin) * Math.random()
  if(a > b) {
    var max = a
    var min = b
  } else {
    var max = b
    var min = a
  }

  return new LFO(
    Math.random()*maxF,
    (min + max)/2,
    Math.random() * (max-min),
    waveform,
  )
}

LFO.prototype.__defineGetter__("waveform", function() {
  return this.osc.waveform
})
LFO.prototype.__defineSetter__("waveform", function(waveform) {
  this.osc.waveform = waveform
})

},{"../Patch.js":51,"../components/Multiply.js":81,"../components/Osc":85,"../components/Sum.js":103}],174:[function(require,module,exports){
const Patch = require("../Patch.js")
const StereoOsc = require("./StereoOsc")
const Repeater = require("../components/Repeater.js")
const Osc = require("../components/Osc")
const Sum = require("../components/Sum.js")
const Multiply = require("../components/Multiply.js")

function ManyOsc(oscs) {
  Patch.call(this)

  var mix = Sum.many(oscs)

  this.addUnits(mix, oscs)

  this.alias(mix.OUT, "OUT")
}
ManyOsc.prototype = Object.create(Patch.prototype)
ManyOsc.prototype.constructor = ManyOsc
module.exports = ManyOsc

ManyOsc.prototype.isManyOsc = true

ManyOsc.ofFrequencies = function(fundamental, ratios) {
  var oscs = []
  for(var i in ratios) {
    var osc = new Osc()
    osc.F = new Multiply(fundamental, ratios[i])
    oscs[i] = osc
  }
  var manyosc = new ManyOsc(oscs)
  return manyosc
}

ManyOsc.random = function(n, min, max) {
  n = n || 3
  min = min || 20
  max = max || 1000
  var freqs = []
  for(var i=0; i<n; i++) {
    freqs[i] = min + Math.random()*(max-min)
  }

  console.log(freqs)
  return ManyOsc.ofFrequencies(1, freqs)
}

},{"../Patch.js":51,"../components/Multiply.js":81,"../components/Osc":85,"../components/Repeater.js":93,"../components/Sum.js":103,"./StereoOsc":187}],175:[function(require,module,exports){
const Patch = require("../Patch.js")
const Osc = require("../components/Osc")
const MidiToFrequency = require("../components/MidiToFrequency.js")

function MidiOsc(p) {
  Patch.call(this)

  this.addUnits(
    this.mToF = new MidiToFrequency(),
    this.osc = new Osc(this.mToF.FREQUENCY),
  )

  this.aliasInlet(this.mToF.MIDI, "P")
  this.aliasOutlet(this.osc.OUT)

  this.P = p || 69
}
MidiOsc.prototype = Object.create(Patch.prototype)
MidiOsc.prototype.constructor = MidiOsc
module.exports = MidiOsc

},{"../Patch.js":51,"../components/MidiToFrequency.js":78,"../components/Osc":85}],176:[function(require,module,exports){
const Patch = require("../Patch.js")
const Repeater = require("../components/Repeater.js")
const Sum = require("../components/Sum.js")
const Multiply = require("../components/Multiply.js")
const Gain = require("../components/Gain.js")

function Mixer(...inputs) {
  Patch.call(this)

  this.sums = []
  this.inputs = []

  this.addUnits(
    this.addRepeater = new Repeater(0)
  )

  this.aliasOutlet(this.addRepeater.OUT)

  for(var i in inputs)
    this.addInput(inputs[i])
}
Mixer.prototype = Object.create(Patch.prototype)
Mixer.prototype.constructor = Mixer
module.exports = Mixer

Mixer.prototype.addInput = function(outlet) {
  if(!outlet.isOutlet && outlet.defaultOutlet)
    outlet = outlet.defaultOutlet

  if(this.inputs.length == 0) {
    this.addRepeater.IN = outlet
    this.inputs.push(outlet)
  } else if(this.inputs.length == 1) {
    var newSum = new Sum(this.addRepeater.IN.outlet, outlet)
    this.addRepeater.IN = newSum
    this.inputs.push(outlet)
    this.sums.push(newSum)
  } else {
    var lastSum = this.sums[this.sums.length-1]
    var lastInput = lastSum.B.outlet
    var newSum = new Sum(lastInput, outlet)
    lastSum.B = newSum
    this.inputs.push(outlet)
    this.sums.push(newSum)
  }
  return this
}

Mixer.prototype.addMultiplied = function(outlet, sf) {
  if(!sf)
    return this.addInput(outlet)
  else
    return this.addInput(
      new Multiply(outlet, sf)
    )
}

Mixer.prototype.addAttenuated = function(outlet, gain) {
  if(!gain)
    return this.addInput(outlet)
  var gainU = new Gain()
  gainU.IN = outlet
  gainU.GAIN = gain
  return this.addInput(gainU)
}

Mixer.prototype.addInputs = function() {
  for(var i in arguments)
    if(arguments[i].constructor == Array)
      for(var j in arguments[i])
        this.addInput(arguments[i][j])
    else
      this.addInput(arguments[i])

  return this
}

Mixer.prototype.removeInputByIndex = function(index) {
  if(index > this.units.length) {
    console.log(this.label, "can't remove input", index,  "because it doesn't exist")
  }
  if(this.inputs.length == 1 && index == 0) {
      this.addRepeater.IN = 0
      this.inputs.shift()
  } else if(this.inputs.length > 0) {
    if(index == this.inputs.length-1) {
      this.sums[this.sums.length-1].collapseA()
      this.sums.splice(this.sums.length-1, 1)
      this.inputs.splice(index, 1)
    } else {
      this.sums[index].collapseB()
      this.sums.splice(index, 1)
      this.inputs.splice(index, 1)
    }
  }
}

Mixer.prototype.removeInput = function(outlet) {
  if(outlet == undefined) {
    console.log(this.label, "can't remove input:", outlet)
    return ;
  }

  if(outlet.constructor == Number)
    return this.removeInputByIndex(outlet)
  if(outlet.isPatch || outlet.isUnit)
    outlet = outlet.defaultOutlet
  if(outlet.isOutlet) {
    var index = this.inputs.indexOf(outlet)
    if(index == -1)
      console.log(this.label, "could not remove", outlet.label, "because it is not connected to it")
    else
      this.removeInputByIndex(index)
  }
}

Mixer.prototype.__defineGetter__("numberOfInputs", function() {
  return this.inputs.length
})

},{"../Patch.js":51,"../components/Gain.js":73,"../components/Multiply.js":81,"../components/Repeater.js":93,"../components/Sum.js":103}],177:[function(require,module,exports){
const Patch = require("../Patch.js")
const CircleBuffer = require("../CircleBuffer.js")
const CircleBufferReader = require("../components/CircleBufferReader.js")
const CircleBufferWriter = require("../components/CircleBufferWriter.js")
const quick = require("../quick.js")


class MultiTapDelay extends Patch {
  constructor(nChannels, maxDelay, input) {
    super()

    if(!nChannels || !maxDelay)
      throw "MultiTapDelay requires constructor args (nChannels, maxDelay[, input])"

    this.addUnits(
      this.buffer = new CircleBuffer(nChannels, maxDelay),
      this.writer = new CircleBufferWriter(this.buffer),
    )

    this.writer.preWipe = true

    this.aliasInlet(this.writer.IN)

    this.IN = input || 0
  }

  addTap(delay) {
    var reader = new CircleBufferReader(this.buffer, delay)
    reader.t = this.writer.t
    this.addUnits(reader)
    reader.chain(this.writer)
    return reader
  }

  addFeedback(delay, feedbackGain, feedbackDelay) {
    var reader = this.addTap(delay)
    var writer = new CircleBufferWriter(this.buffer, feedbackDelay || 0)
    writer.IN = quick.multiply(reader, feedbackGain)
    writer.t = this.writer.t
    writer.chain(this.writer)
    this.addUnits(writer)
    return reader
  }
}
module.exports = MultiTapDelay

},{"../CircleBuffer.js":46,"../Patch.js":51,"../components/CircleBufferReader.js":61,"../components/CircleBufferWriter.js":62,"../quick.js":193}],178:[function(require,module,exports){
const Patch = require("../Patch.js")
const MidiOsc = require("./MidiOsc")
const Osc = require("../components/Osc")
const Space = require("./Space.js")
const ComplexOrbit = require("./ComplexOrbit.js")

function OrbittySine(f, speed, r, centre) {
  Patch.call(this)

  this.addUnits(
    this.osc = new Osc(),
    this.orbit = new ComplexOrbit.random(),
    this.space = new Space(this.osc, this.orbit),
  )

  this.aliasInlet(this.osc.F, "f")
  this.aliasInlet(this.orbit.F, "speed")
  this.aliasInlet(this.orbit.R, "r")
  this.aliasInlet(this.orbit.CENTRE, "centre")
  this.aliasOutlet(this.space.OUT, "out")

  this.F = f || 200
  this.SPEED = speed || 1
  this.R = r || 1
  this.CENTRE = centre || [0,0]
}
OrbittySine.prototype = Object.create(Patch.prototype)
OrbittySine.prototype.constructor = OrbittySine
module.exports = OrbittySine

OrbittySine.prototype.__defineGetter__("waveform", function() {
  return this.osc.waveform
})
OrbittySine.prototype.__defineSetter__("waveform", function(waveform) {
  this.osc.waveform = waveform
})

},{"../Patch.js":51,"../components/Osc":85,"./ComplexOrbit.js":167,"./MidiOsc":175,"./Space.js":183}],179:[function(require,module,exports){
const Patch = require("../Patch.js")
const Space = require("./Space.js")
const Repeater = require("../components/Repeater.js")
const Multiply = require("../components/Multiply.js")

function ScaryPatch(input, ammount) {
  Patch.call(this)

  this.addUnits(
    this.inRepeater = new Repeater(),
    this.ammountScaler = new Multiply(this.inRepeater, 1),
    this.space = new Space(
      this.inRepeater,
      this.ammountScaler
    ),
  )

  this.alias(this.inRepeater.IN)
  this.aliasInlet(this.ammountScaler.B, "ammount")
  this.alias(this.space.OUT)

  this.IN = input || [0,0]
  this.AMMOUNT = ammount || 1
}
ScaryPatch.prototype = Object.create(Patch.prototype)
ScaryPatch.prototype.constructor = ScaryPatch
module.exports = ScaryPatch

},{"../Patch.js":51,"../components/Multiply.js":81,"../components/Repeater.js":93,"./Space.js":183}],180:[function(require,module,exports){
const Patch = require("../Patch.js")
const CrossFader = require("../components/CrossFader.js")
const Delay = require("../components/Delay.js")
const Sum = require("../components/Sum.js")
const Multiply = require("../components/Multiply.js")
const Repeater = require("../components/Repeater.js")
const SecondsToSamples = require("../components/SecondsToSamples.js")

function SimpleDelay(input, delay, feedback, dryWet) {
  Patch.call(this)

  this.addUnits(
    this.inputRepeater = new Repeater(),
    this.feedbackInputSum = new Sum(),
    this.delayer = new Delay(),
    this.mixDryWet = new CrossFader(),
    this.feedbackScaler = new Multiply(),
    this.delayScaler = new SecondsToSamples(),
  )

  this.feedbackInputSum.A = this.inputRepeater.OUT
  this.feedbackInputSum.B = this.feedbackScaler.OUT
  this.feedbackScaler.A = this.delayer.OUT
  this.mixDryWet.B = this.delayer.OUT
  this.mixDryWet.A = this.inputRepeater.OUT
  this.delayer.IN = this.feedbackInputSum.OUT
  this.delayer.DELAY = this.delayScaler.OUT

  this.aliasInlet(this.inputRepeater.IN)
  this.aliasInlet(this.delayScaler.IN, "delay")
  this.aliasInlet(this.feedbackScaler.B, "feedback")
  this.aliasInlet(this.mixDryWet.DIAL, "dryWet")
  this.aliasOutlet(this.mixDryWet.OUT)

  this.IN = input || 0
  this.DELAY = delay || 4410
  this.FEEDBACK = feedback || 0
  this.DRYWET = dryWet || 0.4
}
SimpleDelay.prototype = Object.create(Patch.prototype)
SimpleDelay.prototype.constructor = SimpleDelay
module.exports = SimpleDelay

},{"../Patch.js":51,"../components/CrossFader.js":66,"../components/Delay.js":68,"../components/Multiply.js":81,"../components/Repeater.js":93,"../components/SecondsToSamples.js":97,"../components/Sum.js":103}],181:[function(require,module,exports){
const config = require("../config.js")
const Patch = require("../Patch.js")
const MidiOsc = require("../patches/MidiOsc")
const Ramp = require("../components/Ramp.js")
const Multiply = require("../components/Multiply.js")
const Shape = require("../components/Shape")

function SineBoop(p, duration) {
  Patch.call(this)


  this.addUnits(
    this.osc = new MidiOsc(p),
    this.ramp = new Shape("decay", duration),
    this.multiply = new Multiply(this.ramp, this.osc.OUT),
  )

  this.alias(this.osc.P, "p")
  this.alias(this.ramp.DURATION)
  this.alias(this.multiply.OUT)
  //this.alias(this.ramp.T)

  console.log(this.ramp.print)

  this.P = p || 60
  this.DURATION = duration || 1
}
SineBoop.prototype = Object.create(Patch.prototype)
SineBoop.prototype.constructor = SineBoop
module.exports = SineBoop

SineBoop.randomTwinkle = function(maxDuration) {
  var boop = new SineBoop()
  boop.P = 100 + Math.random()*37
  boop.ramp.randomDecay(maxDuration || 1)
  return boop
}

SineBoop.prototype.trigger = function() {
  this.ramp.trigger()
  this.osc.phase = 0
  return this
}

},{"../Patch.js":51,"../components/Multiply.js":81,"../components/Ramp.js":91,"../components/Shape":99,"../config.js":122,"../patches/MidiOsc":175}],182:[function(require,module,exports){
const Patch = require("../Patch.js")
const OrbittySine = require("./OrbittySine.js")
const Mixer = require("./Mixer.js")
const Repeater = require("../components/Repeater.js")
const Multiply = require("../components/Multiply.js")

function SineCloud(f, speed, r, centre) {
  Patch.call(this)

  this.addUnits(
    this.mixer = new Mixer(),
    this.frequencyRepeater = new Repeater(1),
    this.speedRepeater = new Repeater(1),
    this.radiusRepeater = new Repeater(1),
    this.centreRepeater = new Repeater([0,0]),
  )
  this.orbittySines = []

  this.aliasInlet(this.frequencyRepeater.IN, "f")
  this.aliasInlet(this.speedRepeater.IN, "speed")
  this.aliasInlet(this.radiusRepeater.IN, "r")
  this.aliasInlet(this.centreRepeater.IN, "centre")
  this.aliasOutlet(this.mixer.OUT)

  this.F = f || 1
  this.SPEED = speed || 1
  this.R = r || 1
  this.CENTRE = centre || [0,0]
}
SineCloud.prototype = Object.create(Patch.prototype)
SineCloud.prototype.constructor = SineCloud
module.exports = SineCloud

SineCloud.prototype.addSine = function(f, speed, r) {
  var sine = new OrbittySine(
    new Multiply(f || 1, this.frequencyRepeater),
    new Multiply(speed || 1, this.speedRepeater),
    new Multiply(r || 1, this.radiusRepeater),
    this.centreRepeater,
  )
  this.addUnit(sine)
  this.mixer.addInput(sine)

  this.orbittySines.push(sine)

  return this
}

SineCloud.prototype.__defineSetter__("waveform", function(waveform) {
  for(var i in this.orbittySines)
    this.orbittySines[i].waveform = waveform
})

},{"../Patch.js":51,"../components/Multiply.js":81,"../components/Repeater.js":93,"./Mixer.js":176,"./OrbittySine.js":178}],183:[function(require,module,exports){
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

},{"../Patch.js":51,"../components/ConcatChannels.js":65,"../components/PickChannel.js":88,"../components/Repeater.js":93,"../config.js":122,"./SpaceChannel.js":185}],184:[function(require,module,exports){
const Patch = require("../Patch.js")
const config = require("../config.js")

const MidiToFrequency = require("../components/MidiToFrequency.js")
const Osc = require("../components/Osc")
const Shape = require("../components/Shape")
const Multiply = require("../components/Multiply.js")
const Space = require("../patches/Space.js")
const Divide = require("../components/Divide.js")

function SpaceBoop(p, waveform, d, decayForm, place) {
  Patch.call(this)

  this.addUnits(
    this.mToF = new MidiToFrequency(),
    this.osc = new Osc(this.mToF),
    this.durationToRate = new Divide(1/config.sampleRate),
    this.envelope = new Shape("decay", this.durationToRate),
    this.envelopeAttenuator = new Multiply(this.osc, this.envelope),
    this.space = new Space(this.envelopeAttenuator.OUT),
  )

  this.aliasInlet(this.mToF.MIDI, "p")
  this.aliasInlet(this.space.PLACEMENT, "placement")
  this.aliasInlet(this.durationToRate.B, "duration")
  this.aliasOutlet(this.space.OUT)

  this.P = p || 60
  this.PLACEMENT = place || [0, 0]
  this.DURATION = d || 1
  this.waveform = waveform || "sin"
  this.decayForm = decayForm || "decay"
}
SpaceBoop.prototype = Object.create(Patch.prototype)
SpaceBoop.prototype.constructor = SpaceBoop
module.exports = SpaceBoop

SpaceBoop.prototype.trigger = function(pitch, duration) {
  if(pitch)
    this.P = pitch
  if(duration)
    this.DURATION = duration
  this.osc.phase = 0
  this.envelope.trigger()
}

SpaceBoop.prototype.__defineGetter__("waveform", function() {
  return this.osc.waveform
})
SpaceBoop.prototype.__defineSetter__("waveform", function(waveform) {
  this.osc.waveform = waveform
})
SpaceBoop.prototype.__defineGetter__("decayForm", function() {
  return this.envelope.shape
})
SpaceBoop.prototype.__defineSetter__("decayForm", function(shape) {
  this.envelope.shape = shape
})

},{"../Patch.js":51,"../components/Divide.js":69,"../components/MidiToFrequency.js":78,"../components/Multiply.js":81,"../components/Osc":85,"../components/Shape":99,"../config.js":122,"../patches/Space.js":183}],185:[function(require,module,exports){
const Patch = require("../Patch.js")
const Subtract = require("../components/Subtract.js")
const VectorMagnitude = require("../components/VectorMagnitude.js")
const Multiply = require("../components/Multiply.js")
const Gain = require("../components/Gain.js")
const MonoDelay = require("../components/MonoDelay.js")
const config = require("../config.js")

function SpaceChannel(speakerPosition) {
  Patch.call(this)

  // make units
  this.addUnits(
    this.speakerPositionSubtracter = new Subtract(),
    this.distanceCalculator = new VectorMagnitude(),
    this.attenuationScaler = new Multiply(),
    this.delayScaler = new Multiply(),
    this.delayer = new MonoDelay(),
    this.attenuator = new Gain(),
  )

  // make connections
  this.distanceCalculator.IN = this.speakerPositionSubtracter.OUT
  this.attenuationScaler.A = this.distanceCalculator.OUT
  this.delayScaler.A = this.distanceCalculator.OUT
  this.attenuator.GAIN = this.attenuationScaler.OUT
  this.delayer.DELAY = this.delayScaler.OUT
  this.delayer.IN = this.attenuator.OUT

  // aliasing
  this.aliasInlet(this.attenuator.IN)
  this.aliasInlet(this.speakerPositionSubtracter.A, "placement")
  this.aliasInlet(this.speakerPositionSubtracter.B, "speakerPosition")
  this.aliasInlet(this.attenuationScaler.B, "decibelsPerMeter")
  this.aliasInlet(this.delayScaler.B, "sampleDelayPerMeter")
  this.aliasOutlet(this.delayer.OUT)

  // defaults
  this.IN = 0
  this.PLACEMENT = [0,0]
  this.SPEAKERPOSITION = speakerPosition || [0,0]
  this.DECIBELSPERMETER = -3
  this.SAMPLEDELAYPERMETER = config.sampleRate / 343
}
SpaceChannel.prototype = Object.create(Patch.prototype)
SpaceChannel.prototype.constructor = SpaceChannel
module.exports = SpaceChannel

},{"../Patch.js":51,"../components/Gain.js":73,"../components/MonoDelay.js":80,"../components/Multiply.js":81,"../components/Subtract.js":102,"../components/VectorMagnitude.js":105,"../config.js":122}],186:[function(require,module,exports){
const Patch = require("../Patch.js")
const Multiply = require("../components/Multiply.js")
const quick = require("../quick.js")

function StereoDetune(input, ammount) {
  Patch.call(this)

  ammount = ammount || 0.1*Math.random()

  var ratioL = quick.semitoneToRatio(ammount)
  var ratioR = quick.divide(1, ratioL)
  var ratios = quick.concat(ratioL, ratioR)

  this.addUnits(
    this.mult = new Multiply(input, ratios)
  )

  this.alias(this.mult.A, "in")
  this.alias(this.mult.OUT)
}
StereoDetune.prototype = Object.create(Patch.prototype)
StereoDetune.prototype.constructor = StereoDetune
module.exports = StereoDetune

StereoDetune.random = function(input, maxAmmount) {
  maxAmmount = maxAmmount || 0.1
  var ammount = quick.multiply(maxAmmount, Math.random())
  return new StereoDetune(input, ammount)
}

},{"../Patch.js":51,"../components/Multiply.js":81,"../quick.js":193}],187:[function(require,module,exports){
const Patch = require("../Patch.js")
const Osc = require("../components/Osc")
const Pan = require("../components/Pan.js")
const Gain = require("../components/Gain.js")
const MidiToFrequency = require("../components/MidiToFrequency.js")
const Sum = require("../components/Sum.js")


function StereoOsc(p, gain, pan) {
  Patch.call(this)

  var sum1 = new Sum()
  this.alias(sum1.A, "p")
  this.alias(sum1.B, "pControl")

  var mToF1 = new MidiToFrequency(sum1)

  var osc1 = new Osc()
  osc1.F = mToF1.FREQUENCY
  this.osc = osc1

  var gain1 = new Gain()
  gain1.IN = osc1
  this.alias(gain1.GAIN)

  var pan1 = new Pan()
  pan1.IN = gain1.OUT
  this.alias(pan1.PAN)
  this.alias(pan1.OUT)

  this.addUnit(sum1, mToF1, osc1, gain1, pan1)

  this.GAIN = gain || 0
  this.PAN = pan || 0
  this.P = p || 60
  this.PCONTROL = 0
}
StereoOsc.prototype = Object.create(Patch.prototype)
StereoOsc.prototype.constructor = StereoOsc
module.exports = StereoOsc

StereoOsc.prototype.trigger = function() {
  this.osc.phase = 0
}

StereoOsc.prototype.__defineGetter__("waveform", function() {
  return this.osc.waveform
})
StereoOsc.prototype.__defineSetter__("waveform", function(waveform) {
  this.osc.waveform = waveform
})

},{"../Patch.js":51,"../components/Gain.js":73,"../components/MidiToFrequency.js":78,"../components/Osc":85,"../components/Pan.js":87,"../components/Sum.js":103}],188:[function(require,module,exports){
const Patch = require("../Patch.js")

class Synth extends Patch {
  constructor() {
    super()

    this.triggerList = []
  }

  trigger(p, note) {
    if(this._trigger)
      this._trigger(p, note)

    if(this.triggerList)
      for(var i in this.triggerList)
        this.triggerList[i].trigger()

    return this
  }

  addEnvelope(env) {
    if(env.isOutlet)
      env = env.unit
    this.triggerList.push(env)
    return env
  }
}
module.exports = Synth

},{"../Patch.js":51}],189:[function(require,module,exports){
const Patch = require("../Patch.js")
const Mixer = require("./Mixer.js")

function TriggerGroup() {
  Patch.call(this)

  this.addUnits(
    this.mixer = new Mixer()
  )
  this.triggers = {}

  this.aliasOutlet(this.mixer.OUT)
}
TriggerGroup.prototype = Object.create(Patch.prototype)
TriggerGroup.prototype.constructor = TriggerGroup
module.exports = TriggerGroup

TriggerGroup.prototype.addTrigger = function(trigger, name) {
  if(name == undefined) {
    name = 0
    while(this.triggers[name] != undefined)
      name++
  }
  this.triggers[name] = trigger
  this.mixer.addInput(trigger)
}

TriggerGroup.prototype.trigger = function(which) {
  if(this.triggers[which])
    this.triggers[which].trigger()
  else if(this.handleUnknownTrigger)
    this.handleUnknownTrigger(which)
  else
    console.log(this.label, "unknown trigger:", which)
}

},{"../Patch.js":51,"./Mixer.js":176}],190:[function(require,module,exports){
const Patch = require("../Patch.js")
const Noise = require("../components/Noise")
const Filter = require("../components/Filter.js")
const Repeater = require("../components/Repeater.js")
const quick = require("../quick.js")

class Worm extends Patch {
  constructor(f=1, filterInterval=1) {
    super()

    this.addUnits(
      this.fRepeater = new Repeater(),
      this.noise = new Noise(this.fRepeater),
      this.filter = new Filter(this.noise, quick.multiply(this.fRepeater, filterInterval))
    )

    this.aliasInlet(this.fRepeater.IN, "f")
    this.aliasOutlet(this.filter.OUT)

    this.F = f
  }

  static random(fMax = 5) {
    var f = quick.multiply(fMax, Math.random())
    return new Worm(f)
  }
}
module.exports = Worm

},{"../Patch.js":51,"../components/Filter.js":70,"../components/Noise":82,"../components/Repeater.js":93,"../quick.js":193}],191:[function(require,module,exports){
module.exports = {
	APStack: require("./APStack.js"),
	APWeb: require("./APWeb.js"),
	AttenuationMatrix: require("./AttenuationMatrix.js"),
	BandFilter: require("./BandFilter.js"),
	Boop: require("./Boop.js"),
	ComplexOrbit: require("./ComplexOrbit.js"),
	DelayMixer: require("./DelayMixer.js"),
	FMOsc: require("./FMOsc.js"),
	FMSynth: require("./FMSynth.js"),
	FrequencyGroup: require("./FrequencyGroup.js"),
	HardBandPass: require("./HardBandPass.js"),
	LFO: require("./LFO.js"),
	ManyOsc: require("./ManyOsc.js"),
	MidiOsc: require("./MidiOsc.js"),
	Mixer: require("./Mixer.js"),
	MultiTapDelay: require("./MultiTapDelay.js"),
	OrbittySine: require("./OrbittySine.js"),
	ScaryPatch: require("./ScaryPatch.js"),
	SimpleDelay: require("./SimpleDelay.js"),
	SineBoop: require("./SineBoop.js"),
	SineCloud: require("./SineCloud.js"),
	Space: require("./Space.js"),
	SpaceBoop: require("./SpaceBoop.js"),
	SpaceChannel: require("./SpaceChannel.js"),
	StereoDetune: require("./StereoDetune.js"),
	StereoOsc: require("./StereoOsc.js"),
	Synth: require("./Synth.js"),
	TriggerGroup: require("./TriggerGroup.js"),
	Worm: require("./Worm.js")
}
},{"./APStack.js":162,"./APWeb.js":163,"./AttenuationMatrix.js":164,"./BandFilter.js":165,"./Boop.js":166,"./ComplexOrbit.js":167,"./DelayMixer.js":168,"./FMOsc.js":169,"./FMSynth.js":170,"./FrequencyGroup.js":171,"./HardBandPass.js":172,"./LFO.js":173,"./ManyOsc.js":174,"./MidiOsc.js":175,"./Mixer.js":176,"./MultiTapDelay.js":177,"./OrbittySine.js":178,"./ScaryPatch.js":179,"./SimpleDelay.js":180,"./SineBoop.js":181,"./SineCloud.js":182,"./Space.js":183,"./SpaceBoop.js":184,"./SpaceChannel.js":185,"./StereoDetune.js":186,"./StereoOsc.js":187,"./Synth.js":188,"./TriggerGroup.js":189,"./Worm.js":190}],192:[function(require,module,exports){
const patches = require("./patches")
const components = require("./components")

for(var name in patches)
  if(components[name])
    console.warn("A component and a patch with a common name:", name, "\nthe component will be overwritten")

Object.assign(exports, components, patches)

},{"./components":106,"./patches":191}],193:[function(require,module,exports){
/* quick.js provides a set of operators for combining numbers or signals making
  efficiency savings where possible */

const Sum = require("./components/Sum.js")
const Subtract = require("./components/Subtract.js")
const Multiply = require("./components/Multiply.js")
const Divide = require("./components/Divide.js")
const PolarityInvert = require("./components/PolarityInvert.js")
const SemitoneToRatio = require("./components/SemitoneToRatio.js")
const ConcatChannels = require("./components/ConcatChannels.js")
const Pow = require("./components/Pow.js")
const HardClipAbove = require("./components/HardClipAbove.js")
const HardClipBelow = require("./components/HardClipBelow.js")

exports.add = function(a,b) {
  if(a.constructor == Number && b.constructor == Number)
    return a + b
  else
    return new Sum(a, b)
}

exports.subtract = function(a,b) {
  if(a.constructor == Number && b.constructor == Number)
    return a - b
  else
    return new Subtract(a, b)
}

exports.mult = function(a, b) {
  if(a == undefined || a == null || a == 1)
    return b
  if(b == undefined || b == null || b == 1)
    return a
  if(a.constructor == Number && b.constructor == Number)
    return a * b
  else
    return new Multiply(a, b)
}
exports.multiply = exports.mult

exports.divide = function(a, b) {
  if(a.constructor == Number && b.constructor == Number)
    return a/b
  else
    return new Divide(a, b)
}

exports.invert = function(a) {
  if(a.constructor == Number)
    return -a
  else
    return new PolarityInvert(a)
}

exports.semitoneToRatio = function(p) {
  if(p.constructor == Number)
    return Math.pow(2, p/12);
  else
    return new SemitoneToRatio(p)
}
exports.pToF = function(p) {
  if(p.constructor == Number) {
    return Math.pow(2, (p-69)/12) * 440
  } else
    throw "quick.pToF(non number) has not been implemented"
}

exports.concat = function(a, b) {
  if(a.isUnitOrPatch || a.isOutlet || b.isUnitOrPatch || b.isOutlet)
    return new ConcatChannels(a, b)
  else
    return [].concat(a, b)
}

exports.pow = function(a, b) {
  if(a.isUnitOrPatch || a.isOutlet || b.isUnitOrPatch || b.isOutlet)
    return new Pow(a,b)
  else
    return Math.pow(a, b)
}

exports.clipAbove = function(input, threshold) {
  if(input.isUnitOrPatch || input.isOutlet || threshold.isUnitOrPatch || threshold.isOutlet)
    return new HardClipAbove(input, threshold)
  else // assume numbers
    if(input > threshold)
      return threshold
    else
      return input
}

exports.clipBelow = function(input, threshold) {
  if(input.isUnitOrPatch || input.isOutlet || threshold.isUnitOrPatch || threshold.isOutlet)
    return new HardClipBelow(input, threshold)
  else // assume numbers
    if(input < threshold)
      return threshold
    else
      return input
}

exports.clip = function(input, threshold) {
  if(input.isUnitOrPatch || input.isOutlet || threshold.isUnitOrPatch || threshold.isOutlet)
    return new Clip(input, threshold)
  else // assume numbers
    if(Math.abs(input) < Math.abs(threshold))
      return threshold
    else
      return input
}

},{"./components/ConcatChannels.js":65,"./components/Divide.js":69,"./components/HardClipAbove.js":75,"./components/HardClipBelow.js":76,"./components/Multiply.js":81,"./components/PolarityInvert.js":89,"./components/Pow.js":90,"./components/SemitoneToRatio.js":98,"./components/Subtract.js":102,"./components/Sum.js":103}],194:[function(require,module,exports){
const constructExpression = require("./construct/constructExpression.js")
//const parseExpression = require("./parseDSP/getExpression.js")

function unDusp(o) {
  if(o === null)
    return null
  if(o === undefined)
    return undefined
  if(o.constructor == String)
    return constructExpression(o)

  if(o.constructor == Number)
    return o
  if(o.isUnit || o.isOutlet || o.isPatch)
    return o
}
module.exports = unDusp

},{"./construct/constructExpression.js":124}],195:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return (b64.length * 3 / 4) - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr((len * 3 / 4) - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0; i < l; i += 4) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],196:[function(require,module,exports){

},{}],197:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('Invalid typed array length')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (isArrayBuffer(value)) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  return fromObject(value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj) {
    if (isArrayBufferView(obj) || 'length' in obj) {
      if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
        return createBuffer(0)
      }
      return fromArrayLike(obj)
    }

    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return fromArrayLike(obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (isArrayBufferView(string) || isArrayBuffer(string)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : new Buffer(val, encoding)
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffers from another context (i.e. an iframe) do not pass the `instanceof` check
// but they should be treated as valid. See: https://github.com/feross/buffer/issues/166
function isArrayBuffer (obj) {
  return obj instanceof ArrayBuffer ||
    (obj != null && obj.constructor != null && obj.constructor.name === 'ArrayBuffer' &&
      typeof obj.byteLength === 'number')
}

// Node 0.10 supports `ArrayBuffer` but lacks `ArrayBuffer.isView`
function isArrayBufferView (obj) {
  return (typeof ArrayBuffer.isView === 'function') && ArrayBuffer.isView(obj)
}

function numberIsNaN (obj) {
  return obj !== obj // eslint-disable-line no-self-compare
}

},{"base64-js":195,"ieee754":200}],198:[function(require,module,exports){
(function (Buffer){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.

function isArray(arg) {
  if (Array.isArray) {
    return Array.isArray(arg);
  }
  return objectToString(arg) === '[object Array]';
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = Buffer.isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}

}).call(this,{"isBuffer":require("../../is-buffer/index.js")})
},{"../../is-buffer/index.js":202}],199:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],200:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],201:[function(require,module,exports){
arguments[4][17][0].apply(exports,arguments)
},{"dup":17}],202:[function(require,module,exports){
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
module.exports = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
}

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}

},{}],203:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],204:[function(require,module,exports){
exports.endianness = function () { return 'LE' };

exports.hostname = function () {
    if (typeof location !== 'undefined') {
        return location.hostname
    }
    else return '';
};

exports.loadavg = function () { return [] };

exports.uptime = function () { return 0 };

exports.freemem = function () {
    return Number.MAX_VALUE;
};

exports.totalmem = function () {
    return Number.MAX_VALUE;
};

exports.cpus = function () { return [] };

exports.type = function () { return 'Browser' };

exports.release = function () {
    if (typeof navigator !== 'undefined') {
        return navigator.appVersion;
    }
    return '';
};

exports.networkInterfaces
= exports.getNetworkInterfaces
= function () { return {} };

exports.arch = function () { return 'javascript' };

exports.platform = function () { return 'browser' };

exports.tmpdir = exports.tmpDir = function () {
    return '/tmp';
};

exports.EOL = '\n';

},{}],205:[function(require,module,exports){
(function (process){
'use strict';

if (!process.version ||
    process.version.indexOf('v0.') === 0 ||
    process.version.indexOf('v1.') === 0 && process.version.indexOf('v1.8.') !== 0) {
  module.exports = nextTick;
} else {
  module.exports = process.nextTick;
}

function nextTick(fn, arg1, arg2, arg3) {
  if (typeof fn !== 'function') {
    throw new TypeError('"callback" argument must be a function');
  }
  var len = arguments.length;
  var args, i;
  switch (len) {
  case 0:
  case 1:
    return process.nextTick(fn);
  case 2:
    return process.nextTick(function afterTickOne() {
      fn.call(null, arg1);
    });
  case 3:
    return process.nextTick(function afterTickTwo() {
      fn.call(null, arg1, arg2);
    });
  case 4:
    return process.nextTick(function afterTickThree() {
      fn.call(null, arg1, arg2, arg3);
    });
  default:
    args = new Array(len - 1);
    i = 0;
    while (i < args.length) {
      args[i++] = arguments[i];
    }
    return process.nextTick(function afterTick() {
      fn.apply(null, args);
    });
  }
}

}).call(this,require('_process'))
},{"_process":206}],206:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],207:[function(require,module,exports){
module.exports = require('./lib/_stream_duplex.js');

},{"./lib/_stream_duplex.js":208}],208:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

'use strict';

/*<replacement>*/

var processNextTick = require('process-nextick-args');
/*</replacement>*/

/*<replacement>*/
var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    keys.push(key);
  }return keys;
};
/*</replacement>*/

module.exports = Duplex;

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Readable = require('./_stream_readable');
var Writable = require('./_stream_writable');

util.inherits(Duplex, Readable);

var keys = objectKeys(Writable.prototype);
for (var v = 0; v < keys.length; v++) {
  var method = keys[v];
  if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
}

function Duplex(options) {
  if (!(this instanceof Duplex)) return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false) this.readable = false;

  if (options && options.writable === false) this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;

  this.once('end', onend);
}

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended) return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  processNextTick(onEndNT, this);
}

function onEndNT(self) {
  self.end();
}

Object.defineProperty(Duplex.prototype, 'destroyed', {
  get: function () {
    if (this._readableState === undefined || this._writableState === undefined) {
      return false;
    }
    return this._readableState.destroyed && this._writableState.destroyed;
  },
  set: function (value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (this._readableState === undefined || this._writableState === undefined) {
      return;
    }

    // backward compatibility, the user is explicitly
    // managing destroyed
    this._readableState.destroyed = value;
    this._writableState.destroyed = value;
  }
});

Duplex.prototype._destroy = function (err, cb) {
  this.push(null);
  this.end();

  processNextTick(cb, err);
};

function forEach(xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}
},{"./_stream_readable":210,"./_stream_writable":212,"core-util-is":198,"inherits":201,"process-nextick-args":205}],209:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

'use strict';

module.exports = PassThrough;

var Transform = require('./_stream_transform');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough)) return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function (chunk, encoding, cb) {
  cb(null, chunk);
};
},{"./_stream_transform":211,"core-util-is":198,"inherits":201}],210:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

/*<replacement>*/

var processNextTick = require('process-nextick-args');
/*</replacement>*/

module.exports = Readable;

/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/

/*<replacement>*/
var Duplex;
/*</replacement>*/

Readable.ReadableState = ReadableState;

/*<replacement>*/
var EE = require('events').EventEmitter;

var EElistenerCount = function (emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/

/*<replacement>*/
var Stream = require('./internal/streams/stream');
/*</replacement>*/

// TODO(bmeurer): Change this back to const once hole checks are
// properly optimized away early in Ignition+TurboFan.
/*<replacement>*/
var Buffer = require('safe-buffer').Buffer;
var OurUint8Array = global.Uint8Array || function () {};
function _uint8ArrayToBuffer(chunk) {
  return Buffer.from(chunk);
}
function _isUint8Array(obj) {
  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
}
/*</replacement>*/

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

/*<replacement>*/
var debugUtil = require('util');
var debug = void 0;
if (debugUtil && debugUtil.debuglog) {
  debug = debugUtil.debuglog('stream');
} else {
  debug = function () {};
}
/*</replacement>*/

var BufferList = require('./internal/streams/BufferList');
var destroyImpl = require('./internal/streams/destroy');
var StringDecoder;

util.inherits(Readable, Stream);

var kProxyEvents = ['error', 'close', 'destroy', 'pause', 'resume'];

function prependListener(emitter, event, fn) {
  // Sadly this is not cacheable as some libraries bundle their own
  // event emitter implementation with them.
  if (typeof emitter.prependListener === 'function') {
    return emitter.prependListener(event, fn);
  } else {
    // This is a hack to make sure that our error handler is attached before any
    // userland ones.  NEVER DO THIS. This is here only because this code needs
    // to continue to work with older versions of Node.js that do not include
    // the prependListener() method. The goal is to eventually remove this hack.
    if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);else if (isArray(emitter._events[event])) emitter._events[event].unshift(fn);else emitter._events[event] = [fn, emitter._events[event]];
  }
}

function ReadableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex) this.objectMode = this.objectMode || !!options.readableObjectMode;

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = Math.floor(this.highWaterMark);

  // A linked list is used to store data chunks instead of an array because the
  // linked list can remove elements from the beginning faster than
  // array.shift()
  this.buffer = new BufferList();
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = null;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // a flag to be able to tell if the event 'readable'/'data' is emitted
  // immediately, or on a later tick.  We set this to true at first, because
  // any actions that shouldn't happen until "later" should generally also
  // not happen before the first read call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;
  this.resumeScheduled = false;

  // has it been destroyed
  this.destroyed = false;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder) StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

function Readable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  if (!(this instanceof Readable)) return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  if (options) {
    if (typeof options.read === 'function') this._read = options.read;

    if (typeof options.destroy === 'function') this._destroy = options.destroy;
  }

  Stream.call(this);
}

Object.defineProperty(Readable.prototype, 'destroyed', {
  get: function () {
    if (this._readableState === undefined) {
      return false;
    }
    return this._readableState.destroyed;
  },
  set: function (value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (!this._readableState) {
      return;
    }

    // backward compatibility, the user is explicitly
    // managing destroyed
    this._readableState.destroyed = value;
  }
});

Readable.prototype.destroy = destroyImpl.destroy;
Readable.prototype._undestroy = destroyImpl.undestroy;
Readable.prototype._destroy = function (err, cb) {
  this.push(null);
  cb(err);
};

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function (chunk, encoding) {
  var state = this._readableState;
  var skipChunkCheck;

  if (!state.objectMode) {
    if (typeof chunk === 'string') {
      encoding = encoding || state.defaultEncoding;
      if (encoding !== state.encoding) {
        chunk = Buffer.from(chunk, encoding);
        encoding = '';
      }
      skipChunkCheck = true;
    }
  } else {
    skipChunkCheck = true;
  }

  return readableAddChunk(this, chunk, encoding, false, skipChunkCheck);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function (chunk) {
  return readableAddChunk(this, chunk, null, true, false);
};

function readableAddChunk(stream, chunk, encoding, addToFront, skipChunkCheck) {
  var state = stream._readableState;
  if (chunk === null) {
    state.reading = false;
    onEofChunk(stream, state);
  } else {
    var er;
    if (!skipChunkCheck) er = chunkInvalid(state, chunk);
    if (er) {
      stream.emit('error', er);
    } else if (state.objectMode || chunk && chunk.length > 0) {
      if (typeof chunk !== 'string' && !state.objectMode && Object.getPrototypeOf(chunk) !== Buffer.prototype) {
        chunk = _uint8ArrayToBuffer(chunk);
      }

      if (addToFront) {
        if (state.endEmitted) stream.emit('error', new Error('stream.unshift() after end event'));else addChunk(stream, state, chunk, true);
      } else if (state.ended) {
        stream.emit('error', new Error('stream.push() after EOF'));
      } else {
        state.reading = false;
        if (state.decoder && !encoding) {
          chunk = state.decoder.write(chunk);
          if (state.objectMode || chunk.length !== 0) addChunk(stream, state, chunk, false);else maybeReadMore(stream, state);
        } else {
          addChunk(stream, state, chunk, false);
        }
      }
    } else if (!addToFront) {
      state.reading = false;
    }
  }

  return needMoreData(state);
}

function addChunk(stream, state, chunk, addToFront) {
  if (state.flowing && state.length === 0 && !state.sync) {
    stream.emit('data', chunk);
    stream.read(0);
  } else {
    // update the buffer info.
    state.length += state.objectMode ? 1 : chunk.length;
    if (addToFront) state.buffer.unshift(chunk);else state.buffer.push(chunk);

    if (state.needReadable) emitReadable(stream);
  }
  maybeReadMore(stream, state);
}

function chunkInvalid(state, chunk) {
  var er;
  if (!_isUint8Array(chunk) && typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}

// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
}

Readable.prototype.isPaused = function () {
  return this._readableState.flowing === false;
};

// backwards compatibility.
Readable.prototype.setEncoding = function (enc) {
  if (!StringDecoder) StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
  return this;
};

// Don't raise the hwm > 8MB
var MAX_HWM = 0x800000;
function computeNewHighWaterMark(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2 to prevent increasing hwm excessively in
    // tiny amounts
    n--;
    n |= n >>> 1;
    n |= n >>> 2;
    n |= n >>> 4;
    n |= n >>> 8;
    n |= n >>> 16;
    n++;
  }
  return n;
}

// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function howMuchToRead(n, state) {
  if (n <= 0 || state.length === 0 && state.ended) return 0;
  if (state.objectMode) return 1;
  if (n !== n) {
    // Only flow one buffer at a time
    if (state.flowing && state.length) return state.buffer.head.data.length;else return state.length;
  }
  // If we're asking for more than the current hwm, then raise the hwm.
  if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
  if (n <= state.length) return n;
  // Don't have enough
  if (!state.ended) {
    state.needReadable = true;
    return 0;
  }
  return state.length;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function (n) {
  debug('read', n);
  n = parseInt(n, 10);
  var state = this._readableState;
  var nOrig = n;

  if (n !== 0) state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    if (state.length === 0 && state.ended) endReadable(this);else emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0) endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;
  debug('need readable', doRead);

  // if we currently have less than the highWaterMark, then also read some
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
    debug('length less than watermark', doRead);
  }

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  } else if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0) state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
    // If _read pushed data synchronously, then `reading` will be false,
    // and we need to re-evaluate how much data we can return to the user.
    if (!state.reading) n = howMuchToRead(nOrig, state);
  }

  var ret;
  if (n > 0) ret = fromList(n, state);else ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  } else {
    state.length -= n;
  }

  if (state.length === 0) {
    // If we have nothing in the buffer, then we want to know
    // as soon as we *do* get something into the buffer.
    if (!state.ended) state.needReadable = true;

    // If we tried to read() past the EOF, then emit end on the next tick.
    if (nOrig !== n && state.ended) endReadable(this);
  }

  if (ret !== null) this.emit('data', ret);

  return ret;
};

function onEofChunk(stream, state) {
  if (state.ended) return;
  if (state.decoder) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // emit 'readable' now to make sure it gets picked up.
  emitReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing);
    state.emittedReadable = true;
    if (state.sync) processNextTick(emitReadable_, stream);else emitReadable_(stream);
  }
}

function emitReadable_(stream) {
  debug('emit readable');
  stream.emit('readable');
  flow(stream);
}

// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    processNextTick(maybeReadMore_, stream, state);
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
    debug('maybeReadMore read 0');
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;else len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function (n) {
  this.emit('error', new Error('_read() is not implemented'));
};

Readable.prototype.pipe = function (dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;
  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

  var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;

  var endFn = doEnd ? onend : unpipe;
  if (state.endEmitted) processNextTick(endFn);else src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable, unpipeInfo) {
    debug('onunpipe');
    if (readable === src) {
      if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
        unpipeInfo.hasUnpiped = true;
        cleanup();
      }
    }
  }

  function onend() {
    debug('onend');
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  var cleanedUp = false;
  function cleanup() {
    debug('cleanup');
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', unpipe);
    src.removeListener('data', ondata);

    cleanedUp = true;

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
  }

  // If the user pushes more data while we're writing to dest then we'll end up
  // in ondata again. However, we only want to increase awaitDrain once because
  // dest will only emit one 'drain' event for the multiple writes.
  // => Introduce a guard on increasing awaitDrain.
  var increasedAwaitDrain = false;
  src.on('data', ondata);
  function ondata(chunk) {
    debug('ondata');
    increasedAwaitDrain = false;
    var ret = dest.write(chunk);
    if (false === ret && !increasedAwaitDrain) {
      // If the user unpiped during `dest.write()`, it is possible
      // to get stuck in a permanently paused state if that write
      // also returned false.
      // => Check whether `dest` is still a piping destination.
      if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
        debug('false write response, pause', src._readableState.awaitDrain);
        src._readableState.awaitDrain++;
        increasedAwaitDrain = true;
      }
      src.pause();
    }
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    debug('onerror', er);
    unpipe();
    dest.removeListener('error', onerror);
    if (EElistenerCount(dest, 'error') === 0) dest.emit('error', er);
  }

  // Make sure our error handler is attached before userland ones.
  prependListener(dest, 'error', onerror);

  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    debug('onfinish');
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    debug('unpipe');
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    debug('pipe resume');
    src.resume();
  }

  return dest;
};

function pipeOnDrain(src) {
  return function () {
    var state = src._readableState;
    debug('pipeOnDrain', state.awaitDrain);
    if (state.awaitDrain) state.awaitDrain--;
    if (state.awaitDrain === 0 && EElistenerCount(src, 'data')) {
      state.flowing = true;
      flow(src);
    }
  };
}

Readable.prototype.unpipe = function (dest) {
  var state = this._readableState;
  var unpipeInfo = { hasUnpiped: false };

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0) return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes) return this;

    if (!dest) dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    if (dest) dest.emit('unpipe', this, unpipeInfo);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;

    for (var i = 0; i < len; i++) {
      dests[i].emit('unpipe', this, unpipeInfo);
    }return this;
  }

  // try to find the right one.
  var index = indexOf(state.pipes, dest);
  if (index === -1) return this;

  state.pipes.splice(index, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1) state.pipes = state.pipes[0];

  dest.emit('unpipe', this, unpipeInfo);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function (ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  if (ev === 'data') {
    // Start flowing on next tick if stream isn't explicitly paused
    if (this._readableState.flowing !== false) this.resume();
  } else if (ev === 'readable') {
    var state = this._readableState;
    if (!state.endEmitted && !state.readableListening) {
      state.readableListening = state.needReadable = true;
      state.emittedReadable = false;
      if (!state.reading) {
        processNextTick(nReadingNextTick, this);
      } else if (state.length) {
        emitReadable(this);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

function nReadingNextTick(self) {
  debug('readable nexttick read 0');
  self.read(0);
}

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function () {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume');
    state.flowing = true;
    resume(this, state);
  }
  return this;
};

function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    processNextTick(resume_, stream, state);
  }
}

function resume_(stream, state) {
  if (!state.reading) {
    debug('resume read 0');
    stream.read(0);
  }

  state.resumeScheduled = false;
  state.awaitDrain = 0;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading) stream.read(0);
}

Readable.prototype.pause = function () {
  debug('call pause flowing=%j', this._readableState.flowing);
  if (false !== this._readableState.flowing) {
    debug('pause');
    this._readableState.flowing = false;
    this.emit('pause');
  }
  return this;
};

function flow(stream) {
  var state = stream._readableState;
  debug('flow', state.flowing);
  while (state.flowing && stream.read() !== null) {}
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function (stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function () {
    debug('wrapped end');
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length) self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function (chunk) {
    debug('wrapped data');
    if (state.decoder) chunk = state.decoder.write(chunk);

    // don't skip over falsy values in objectMode
    if (state.objectMode && (chunk === null || chunk === undefined)) return;else if (!state.objectMode && (!chunk || !chunk.length)) return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (this[i] === undefined && typeof stream[i] === 'function') {
      this[i] = function (method) {
        return function () {
          return stream[method].apply(stream, arguments);
        };
      }(i);
    }
  }

  // proxy certain important events.
  for (var n = 0; n < kProxyEvents.length; n++) {
    stream.on(kProxyEvents[n], self.emit.bind(self, kProxyEvents[n]));
  }

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function (n) {
    debug('wrapped _read', n);
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};

// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function fromList(n, state) {
  // nothing buffered
  if (state.length === 0) return null;

  var ret;
  if (state.objectMode) ret = state.buffer.shift();else if (!n || n >= state.length) {
    // read it all, truncate the list
    if (state.decoder) ret = state.buffer.join('');else if (state.buffer.length === 1) ret = state.buffer.head.data;else ret = state.buffer.concat(state.length);
    state.buffer.clear();
  } else {
    // read part of list
    ret = fromListPartial(n, state.buffer, state.decoder);
  }

  return ret;
}

// Extracts only enough buffered data to satisfy the amount requested.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function fromListPartial(n, list, hasStrings) {
  var ret;
  if (n < list.head.data.length) {
    // slice is the same for buffers and strings
    ret = list.head.data.slice(0, n);
    list.head.data = list.head.data.slice(n);
  } else if (n === list.head.data.length) {
    // first chunk is a perfect match
    ret = list.shift();
  } else {
    // result spans more than one buffer
    ret = hasStrings ? copyFromBufferString(n, list) : copyFromBuffer(n, list);
  }
  return ret;
}

// Copies a specified amount of characters from the list of buffered data
// chunks.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function copyFromBufferString(n, list) {
  var p = list.head;
  var c = 1;
  var ret = p.data;
  n -= ret.length;
  while (p = p.next) {
    var str = p.data;
    var nb = n > str.length ? str.length : n;
    if (nb === str.length) ret += str;else ret += str.slice(0, n);
    n -= nb;
    if (n === 0) {
      if (nb === str.length) {
        ++c;
        if (p.next) list.head = p.next;else list.head = list.tail = null;
      } else {
        list.head = p;
        p.data = str.slice(nb);
      }
      break;
    }
    ++c;
  }
  list.length -= c;
  return ret;
}

// Copies a specified amount of bytes from the list of buffered data chunks.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function copyFromBuffer(n, list) {
  var ret = Buffer.allocUnsafe(n);
  var p = list.head;
  var c = 1;
  p.data.copy(ret);
  n -= p.data.length;
  while (p = p.next) {
    var buf = p.data;
    var nb = n > buf.length ? buf.length : n;
    buf.copy(ret, ret.length - n, 0, nb);
    n -= nb;
    if (n === 0) {
      if (nb === buf.length) {
        ++c;
        if (p.next) list.head = p.next;else list.head = list.tail = null;
      } else {
        list.head = p;
        p.data = buf.slice(nb);
      }
      break;
    }
    ++c;
  }
  list.length -= c;
  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0) throw new Error('"endReadable()" called on non-empty stream');

  if (!state.endEmitted) {
    state.ended = true;
    processNextTick(endReadableNT, state, stream);
  }
}

function endReadableNT(state, stream) {
  // Check that we didn't get one last unshift.
  if (!state.endEmitted && state.length === 0) {
    state.endEmitted = true;
    stream.readable = false;
    stream.emit('end');
  }
}

function forEach(xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

function indexOf(xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}
}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./_stream_duplex":208,"./internal/streams/BufferList":213,"./internal/streams/destroy":214,"./internal/streams/stream":215,"_process":206,"core-util-is":198,"events":199,"inherits":201,"isarray":203,"process-nextick-args":205,"safe-buffer":220,"string_decoder/":222,"util":196}],211:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

'use strict';

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);

function TransformState(stream) {
  this.afterTransform = function (er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
  this.writeencoding = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb) {
    return stream.emit('error', new Error('write callback called multiple times'));
  }

  ts.writechunk = null;
  ts.writecb = null;

  if (data !== null && data !== undefined) stream.push(data);

  cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}

function Transform(options) {
  if (!(this instanceof Transform)) return new Transform(options);

  Duplex.call(this, options);

  this._transformState = new TransformState(this);

  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  if (options) {
    if (typeof options.transform === 'function') this._transform = options.transform;

    if (typeof options.flush === 'function') this._flush = options.flush;
  }

  // When the writable side finishes, then flush out anything remaining.
  this.once('prefinish', function () {
    if (typeof this._flush === 'function') this._flush(function (er, data) {
      done(stream, er, data);
    });else done(stream);
  });
}

Transform.prototype.push = function (chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function (chunk, encoding, cb) {
  throw new Error('_transform() is not implemented');
};

Transform.prototype._write = function (chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function (n) {
  var ts = this._transformState;

  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};

Transform.prototype._destroy = function (err, cb) {
  var _this = this;

  Duplex.prototype._destroy.call(this, err, function (err2) {
    cb(err2);
    _this.emit('close');
  });
};

function done(stream, er, data) {
  if (er) return stream.emit('error', er);

  if (data !== null && data !== undefined) stream.push(data);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var ts = stream._transformState;

  if (ws.length) throw new Error('Calling transform done when ws.length != 0');

  if (ts.transforming) throw new Error('Calling transform done when still transforming');

  return stream.push(null);
}
},{"./_stream_duplex":208,"core-util-is":198,"inherits":201}],212:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// A bit simpler than readable streams.
// Implement an async ._write(chunk, encoding, cb), and it'll handle all
// the drain event emission and buffering.

'use strict';

/*<replacement>*/

var processNextTick = require('process-nextick-args');
/*</replacement>*/

module.exports = Writable;

/* <replacement> */
function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
  this.next = null;
}

// It seems a linked list but it is not
// there will be only 2 of these for each stream
function CorkedRequest(state) {
  var _this = this;

  this.next = null;
  this.entry = null;
  this.finish = function () {
    onCorkedFinish(_this, state);
  };
}
/* </replacement> */

/*<replacement>*/
var asyncWrite = !process.browser && ['v0.10', 'v0.9.'].indexOf(process.version.slice(0, 5)) > -1 ? setImmediate : processNextTick;
/*</replacement>*/

/*<replacement>*/
var Duplex;
/*</replacement>*/

Writable.WritableState = WritableState;

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

/*<replacement>*/
var internalUtil = {
  deprecate: require('util-deprecate')
};
/*</replacement>*/

/*<replacement>*/
var Stream = require('./internal/streams/stream');
/*</replacement>*/

/*<replacement>*/
var Buffer = require('safe-buffer').Buffer;
var OurUint8Array = global.Uint8Array || function () {};
function _uint8ArrayToBuffer(chunk) {
  return Buffer.from(chunk);
}
function _isUint8Array(obj) {
  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
}
/*</replacement>*/

var destroyImpl = require('./internal/streams/destroy');

util.inherits(Writable, Stream);

function nop() {}

function WritableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex) this.objectMode = this.objectMode || !!options.writableObjectMode;

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = Math.floor(this.highWaterMark);

  // if _final has been called
  this.finalCalled = false;

  // drain event flag.
  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // has it been destroyed
  this.destroyed = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // when true all writes will be buffered until .uncork() call
  this.corked = 0;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function (er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.bufferedRequest = null;
  this.lastBufferedRequest = null;

  // number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted
  this.pendingcb = 0;

  // emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams
  this.prefinished = false;

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;

  // count buffered requests
  this.bufferedRequestCount = 0;

  // allocate the first CorkedRequest, there is always
  // one allocated and free to use, and we maintain at most two
  this.corkedRequestsFree = new CorkedRequest(this);
}

WritableState.prototype.getBuffer = function getBuffer() {
  var current = this.bufferedRequest;
  var out = [];
  while (current) {
    out.push(current);
    current = current.next;
  }
  return out;
};

(function () {
  try {
    Object.defineProperty(WritableState.prototype, 'buffer', {
      get: internalUtil.deprecate(function () {
        return this.getBuffer();
      }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' + 'instead.', 'DEP0003')
    });
  } catch (_) {}
})();

// Test _writableState for inheritance to account for Duplex streams,
// whose prototype chain only points to Readable.
var realHasInstance;
if (typeof Symbol === 'function' && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] === 'function') {
  realHasInstance = Function.prototype[Symbol.hasInstance];
  Object.defineProperty(Writable, Symbol.hasInstance, {
    value: function (object) {
      if (realHasInstance.call(this, object)) return true;

      return object && object._writableState instanceof WritableState;
    }
  });
} else {
  realHasInstance = function (object) {
    return object instanceof this;
  };
}

function Writable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, too.
  // `realHasInstance` is necessary because using plain `instanceof`
  // would return false, as no `_writableState` property is attached.

  // Trying to use the custom `instanceof` for Writable here will also break the
  // Node.js LazyTransform implementation, which has a non-trivial getter for
  // `_writableState` that would lead to infinite recursion.
  if (!realHasInstance.call(Writable, this) && !(this instanceof Duplex)) {
    return new Writable(options);
  }

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  if (options) {
    if (typeof options.write === 'function') this._write = options.write;

    if (typeof options.writev === 'function') this._writev = options.writev;

    if (typeof options.destroy === 'function') this._destroy = options.destroy;

    if (typeof options.final === 'function') this._final = options.final;
  }

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function () {
  this.emit('error', new Error('Cannot pipe, not readable'));
};

function writeAfterEnd(stream, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  processNextTick(cb, er);
}

// Checks that a user-supplied chunk is valid, especially for the particular
// mode the stream is in. Currently this means that `null` is never accepted
// and undefined/non-string values are only allowed in object mode.
function validChunk(stream, state, chunk, cb) {
  var valid = true;
  var er = false;

  if (chunk === null) {
    er = new TypeError('May not write null values to stream');
  } else if (typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  if (er) {
    stream.emit('error', er);
    processNextTick(cb, er);
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function (chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;
  var isBuf = _isUint8Array(chunk) && !state.objectMode;

  if (isBuf && !Buffer.isBuffer(chunk)) {
    chunk = _uint8ArrayToBuffer(chunk);
  }

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (isBuf) encoding = 'buffer';else if (!encoding) encoding = state.defaultEncoding;

  if (typeof cb !== 'function') cb = nop;

  if (state.ended) writeAfterEnd(this, cb);else if (isBuf || validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    ret = writeOrBuffer(this, state, isBuf, chunk, encoding, cb);
  }

  return ret;
};

Writable.prototype.cork = function () {
  var state = this._writableState;

  state.corked++;
};

Writable.prototype.uncork = function () {
  var state = this._writableState;

  if (state.corked) {
    state.corked--;

    if (!state.writing && !state.corked && !state.finished && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
  }
};

Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
  // node::ParseEncoding() requires lower case.
  if (typeof encoding === 'string') encoding = encoding.toLowerCase();
  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'raw'].indexOf((encoding + '').toLowerCase()) > -1)) throw new TypeError('Unknown encoding: ' + encoding);
  this._writableState.defaultEncoding = encoding;
  return this;
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode && state.decodeStrings !== false && typeof chunk === 'string') {
    chunk = Buffer.from(chunk, encoding);
  }
  return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, isBuf, chunk, encoding, cb) {
  if (!isBuf) {
    var newChunk = decodeChunk(state, chunk, encoding);
    if (chunk !== newChunk) {
      isBuf = true;
      encoding = 'buffer';
      chunk = newChunk;
    }
  }
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret) state.needDrain = true;

  if (state.writing || state.corked) {
    var last = state.lastBufferedRequest;
    state.lastBufferedRequest = {
      chunk: chunk,
      encoding: encoding,
      isBuf: isBuf,
      callback: cb,
      next: null
    };
    if (last) {
      last.next = state.lastBufferedRequest;
    } else {
      state.bufferedRequest = state.lastBufferedRequest;
    }
    state.bufferedRequestCount += 1;
  } else {
    doWrite(stream, state, false, len, chunk, encoding, cb);
  }

  return ret;
}

function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (writev) stream._writev(chunk, state.onwrite);else stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  --state.pendingcb;

  if (sync) {
    // defer the callback if we are being called synchronously
    // to avoid piling up things on the stack
    processNextTick(cb, er);
    // this can emit finish, and it will always happen
    // after error
    processNextTick(finishMaybe, stream, state);
    stream._writableState.errorEmitted = true;
    stream.emit('error', er);
  } else {
    // the caller expect this to happen before if
    // it is async
    cb(er);
    stream._writableState.errorEmitted = true;
    stream.emit('error', er);
    // this can emit finish, but finish must
    // always follow error
    finishMaybe(stream, state);
  }
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er) onwriteError(stream, state, sync, er, cb);else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(state);

    if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
      clearBuffer(stream, state);
    }

    if (sync) {
      /*<replacement>*/
      asyncWrite(afterWrite, stream, state, finished, cb);
      /*</replacement>*/
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished) onwriteDrain(stream, state);
  state.pendingcb--;
  cb();
  finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}

// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;
  var entry = state.bufferedRequest;

  if (stream._writev && entry && entry.next) {
    // Fast case, write everything using _writev()
    var l = state.bufferedRequestCount;
    var buffer = new Array(l);
    var holder = state.corkedRequestsFree;
    holder.entry = entry;

    var count = 0;
    var allBuffers = true;
    while (entry) {
      buffer[count] = entry;
      if (!entry.isBuf) allBuffers = false;
      entry = entry.next;
      count += 1;
    }
    buffer.allBuffers = allBuffers;

    doWrite(stream, state, true, state.length, buffer, '', holder.finish);

    // doWrite is almost always async, defer these to save a bit of time
    // as the hot path ends with doWrite
    state.pendingcb++;
    state.lastBufferedRequest = null;
    if (holder.next) {
      state.corkedRequestsFree = holder.next;
      holder.next = null;
    } else {
      state.corkedRequestsFree = new CorkedRequest(state);
    }
  } else {
    // Slow case, write chunks one-by-one
    while (entry) {
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;

      doWrite(stream, state, false, len, chunk, encoding, cb);
      entry = entry.next;
      // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.
      if (state.writing) {
        break;
      }
    }

    if (entry === null) state.lastBufferedRequest = null;
  }

  state.bufferedRequestCount = 0;
  state.bufferedRequest = entry;
  state.bufferProcessing = false;
}

Writable.prototype._write = function (chunk, encoding, cb) {
  cb(new Error('_write() is not implemented'));
};

Writable.prototype._writev = null;

Writable.prototype.end = function (chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (chunk !== null && chunk !== undefined) this.write(chunk, encoding);

  // .end() fully uncorks
  if (state.corked) {
    state.corked = 1;
    this.uncork();
  }

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished) endWritable(this, state, cb);
};

function needFinish(state) {
  return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
}
function callFinal(stream, state) {
  stream._final(function (err) {
    state.pendingcb--;
    if (err) {
      stream.emit('error', err);
    }
    state.prefinished = true;
    stream.emit('prefinish');
    finishMaybe(stream, state);
  });
}
function prefinish(stream, state) {
  if (!state.prefinished && !state.finalCalled) {
    if (typeof stream._final === 'function') {
      state.pendingcb++;
      state.finalCalled = true;
      processNextTick(callFinal, stream, state);
    } else {
      state.prefinished = true;
      stream.emit('prefinish');
    }
  }
}

function finishMaybe(stream, state) {
  var need = needFinish(state);
  if (need) {
    prefinish(stream, state);
    if (state.pendingcb === 0) {
      state.finished = true;
      stream.emit('finish');
    }
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished) processNextTick(cb);else stream.once('finish', cb);
  }
  state.ended = true;
  stream.writable = false;
}

function onCorkedFinish(corkReq, state, err) {
  var entry = corkReq.entry;
  corkReq.entry = null;
  while (entry) {
    var cb = entry.callback;
    state.pendingcb--;
    cb(err);
    entry = entry.next;
  }
  if (state.corkedRequestsFree) {
    state.corkedRequestsFree.next = corkReq;
  } else {
    state.corkedRequestsFree = corkReq;
  }
}

Object.defineProperty(Writable.prototype, 'destroyed', {
  get: function () {
    if (this._writableState === undefined) {
      return false;
    }
    return this._writableState.destroyed;
  },
  set: function (value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (!this._writableState) {
      return;
    }

    // backward compatibility, the user is explicitly
    // managing destroyed
    this._writableState.destroyed = value;
  }
});

Writable.prototype.destroy = destroyImpl.destroy;
Writable.prototype._undestroy = destroyImpl.undestroy;
Writable.prototype._destroy = function (err, cb) {
  this.end();
  cb(err);
};
}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./_stream_duplex":208,"./internal/streams/destroy":214,"./internal/streams/stream":215,"_process":206,"core-util-is":198,"inherits":201,"process-nextick-args":205,"safe-buffer":220,"util-deprecate":223}],213:[function(require,module,exports){
'use strict';

/*<replacement>*/

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Buffer = require('safe-buffer').Buffer;
/*</replacement>*/

function copyBuffer(src, target, offset) {
  src.copy(target, offset);
}

module.exports = function () {
  function BufferList() {
    _classCallCheck(this, BufferList);

    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  BufferList.prototype.push = function push(v) {
    var entry = { data: v, next: null };
    if (this.length > 0) this.tail.next = entry;else this.head = entry;
    this.tail = entry;
    ++this.length;
  };

  BufferList.prototype.unshift = function unshift(v) {
    var entry = { data: v, next: this.head };
    if (this.length === 0) this.tail = entry;
    this.head = entry;
    ++this.length;
  };

  BufferList.prototype.shift = function shift() {
    if (this.length === 0) return;
    var ret = this.head.data;
    if (this.length === 1) this.head = this.tail = null;else this.head = this.head.next;
    --this.length;
    return ret;
  };

  BufferList.prototype.clear = function clear() {
    this.head = this.tail = null;
    this.length = 0;
  };

  BufferList.prototype.join = function join(s) {
    if (this.length === 0) return '';
    var p = this.head;
    var ret = '' + p.data;
    while (p = p.next) {
      ret += s + p.data;
    }return ret;
  };

  BufferList.prototype.concat = function concat(n) {
    if (this.length === 0) return Buffer.alloc(0);
    if (this.length === 1) return this.head.data;
    var ret = Buffer.allocUnsafe(n >>> 0);
    var p = this.head;
    var i = 0;
    while (p) {
      copyBuffer(p.data, ret, i);
      i += p.data.length;
      p = p.next;
    }
    return ret;
  };

  return BufferList;
}();
},{"safe-buffer":220}],214:[function(require,module,exports){
'use strict';

/*<replacement>*/

var processNextTick = require('process-nextick-args');
/*</replacement>*/

// undocumented cb() API, needed for core, not for public API
function destroy(err, cb) {
  var _this = this;

  var readableDestroyed = this._readableState && this._readableState.destroyed;
  var writableDestroyed = this._writableState && this._writableState.destroyed;

  if (readableDestroyed || writableDestroyed) {
    if (cb) {
      cb(err);
    } else if (err && (!this._writableState || !this._writableState.errorEmitted)) {
      processNextTick(emitErrorNT, this, err);
    }
    return;
  }

  // we set destroyed to true before firing error callbacks in order
  // to make it re-entrance safe in case destroy() is called within callbacks

  if (this._readableState) {
    this._readableState.destroyed = true;
  }

  // if this is a duplex stream mark the writable part as destroyed as well
  if (this._writableState) {
    this._writableState.destroyed = true;
  }

  this._destroy(err || null, function (err) {
    if (!cb && err) {
      processNextTick(emitErrorNT, _this, err);
      if (_this._writableState) {
        _this._writableState.errorEmitted = true;
      }
    } else if (cb) {
      cb(err);
    }
  });
}

function undestroy() {
  if (this._readableState) {
    this._readableState.destroyed = false;
    this._readableState.reading = false;
    this._readableState.ended = false;
    this._readableState.endEmitted = false;
  }

  if (this._writableState) {
    this._writableState.destroyed = false;
    this._writableState.ended = false;
    this._writableState.ending = false;
    this._writableState.finished = false;
    this._writableState.errorEmitted = false;
  }
}

function emitErrorNT(self, err) {
  self.emit('error', err);
}

module.exports = {
  destroy: destroy,
  undestroy: undestroy
};
},{"process-nextick-args":205}],215:[function(require,module,exports){
module.exports = require('events').EventEmitter;

},{"events":199}],216:[function(require,module,exports){
module.exports = require('./readable').PassThrough

},{"./readable":217}],217:[function(require,module,exports){
exports = module.exports = require('./lib/_stream_readable.js');
exports.Stream = exports;
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

},{"./lib/_stream_duplex.js":208,"./lib/_stream_passthrough.js":209,"./lib/_stream_readable.js":210,"./lib/_stream_transform.js":211,"./lib/_stream_writable.js":212}],218:[function(require,module,exports){
module.exports = require('./readable').Transform

},{"./readable":217}],219:[function(require,module,exports){
module.exports = require('./lib/_stream_writable.js');

},{"./lib/_stream_writable.js":212}],220:[function(require,module,exports){
/* eslint-disable node/no-deprecated-api */
var buffer = require('buffer')
var Buffer = buffer.Buffer

// alternative to using Object.keys for old browsers
function copyProps (src, dst) {
  for (var key in src) {
    dst[key] = src[key]
  }
}
if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
  module.exports = buffer
} else {
  // Copy properties from require('buffer')
  copyProps(buffer, exports)
  exports.Buffer = SafeBuffer
}

function SafeBuffer (arg, encodingOrOffset, length) {
  return Buffer(arg, encodingOrOffset, length)
}

// Copy static methods from Buffer
copyProps(Buffer, SafeBuffer)

SafeBuffer.from = function (arg, encodingOrOffset, length) {
  if (typeof arg === 'number') {
    throw new TypeError('Argument must not be a number')
  }
  return Buffer(arg, encodingOrOffset, length)
}

SafeBuffer.alloc = function (size, fill, encoding) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  var buf = Buffer(size)
  if (fill !== undefined) {
    if (typeof encoding === 'string') {
      buf.fill(fill, encoding)
    } else {
      buf.fill(fill)
    }
  } else {
    buf.fill(0)
  }
  return buf
}

SafeBuffer.allocUnsafe = function (size) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return Buffer(size)
}

SafeBuffer.allocUnsafeSlow = function (size) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return buffer.SlowBuffer(size)
}

},{"buffer":197}],221:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Stream;

var EE = require('events').EventEmitter;
var inherits = require('inherits');

inherits(Stream, EE);
Stream.Readable = require('readable-stream/readable.js');
Stream.Writable = require('readable-stream/writable.js');
Stream.Duplex = require('readable-stream/duplex.js');
Stream.Transform = require('readable-stream/transform.js');
Stream.PassThrough = require('readable-stream/passthrough.js');

// Backwards-compat with node 0.4.x
Stream.Stream = Stream;



// old-style streams.  Note that the pipe method (the only relevant
// part of this class) is overridden in the Readable class.

function Stream() {
  EE.call(this);
}

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once.
  if (!dest._isStdio && (!options || options.end !== false)) {
    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    if (typeof dest.destroy === 'function') dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (EE.listenerCount(this, 'error') === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

},{"events":199,"inherits":201,"readable-stream/duplex.js":207,"readable-stream/passthrough.js":216,"readable-stream/readable.js":217,"readable-stream/transform.js":218,"readable-stream/writable.js":219}],222:[function(require,module,exports){
'use strict';

var Buffer = require('safe-buffer').Buffer;

var isEncoding = Buffer.isEncoding || function (encoding) {
  encoding = '' + encoding;
  switch (encoding && encoding.toLowerCase()) {
    case 'hex':case 'utf8':case 'utf-8':case 'ascii':case 'binary':case 'base64':case 'ucs2':case 'ucs-2':case 'utf16le':case 'utf-16le':case 'raw':
      return true;
    default:
      return false;
  }
};

function _normalizeEncoding(enc) {
  if (!enc) return 'utf8';
  var retried;
  while (true) {
    switch (enc) {
      case 'utf8':
      case 'utf-8':
        return 'utf8';
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return 'utf16le';
      case 'latin1':
      case 'binary':
        return 'latin1';
      case 'base64':
      case 'ascii':
      case 'hex':
        return enc;
      default:
        if (retried) return; // undefined
        enc = ('' + enc).toLowerCase();
        retried = true;
    }
  }
};

// Do not cache `Buffer.isEncoding` when checking encoding names as some
// modules monkey-patch it to support additional encodings
function normalizeEncoding(enc) {
  var nenc = _normalizeEncoding(enc);
  if (typeof nenc !== 'string' && (Buffer.isEncoding === isEncoding || !isEncoding(enc))) throw new Error('Unknown encoding: ' + enc);
  return nenc || enc;
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters.
exports.StringDecoder = StringDecoder;
function StringDecoder(encoding) {
  this.encoding = normalizeEncoding(encoding);
  var nb;
  switch (this.encoding) {
    case 'utf16le':
      this.text = utf16Text;
      this.end = utf16End;
      nb = 4;
      break;
    case 'utf8':
      this.fillLast = utf8FillLast;
      nb = 4;
      break;
    case 'base64':
      this.text = base64Text;
      this.end = base64End;
      nb = 3;
      break;
    default:
      this.write = simpleWrite;
      this.end = simpleEnd;
      return;
  }
  this.lastNeed = 0;
  this.lastTotal = 0;
  this.lastChar = Buffer.allocUnsafe(nb);
}

StringDecoder.prototype.write = function (buf) {
  if (buf.length === 0) return '';
  var r;
  var i;
  if (this.lastNeed) {
    r = this.fillLast(buf);
    if (r === undefined) return '';
    i = this.lastNeed;
    this.lastNeed = 0;
  } else {
    i = 0;
  }
  if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
  return r || '';
};

StringDecoder.prototype.end = utf8End;

// Returns only complete characters in a Buffer
StringDecoder.prototype.text = utf8Text;

// Attempts to complete a partial non-UTF-8 character using bytes from a Buffer
StringDecoder.prototype.fillLast = function (buf) {
  if (this.lastNeed <= buf.length) {
    buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
    return this.lastChar.toString(this.encoding, 0, this.lastTotal);
  }
  buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
  this.lastNeed -= buf.length;
};

// Checks the type of a UTF-8 byte, whether it's ASCII, a leading byte, or a
// continuation byte.
function utf8CheckByte(byte) {
  if (byte <= 0x7F) return 0;else if (byte >> 5 === 0x06) return 2;else if (byte >> 4 === 0x0E) return 3;else if (byte >> 3 === 0x1E) return 4;
  return -1;
}

// Checks at most 3 bytes at the end of a Buffer in order to detect an
// incomplete multi-byte UTF-8 character. The total number of bytes (2, 3, or 4)
// needed to complete the UTF-8 character (if applicable) are returned.
function utf8CheckIncomplete(self, buf, i) {
  var j = buf.length - 1;
  if (j < i) return 0;
  var nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) self.lastNeed = nb - 1;
    return nb;
  }
  if (--j < i) return 0;
  nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) self.lastNeed = nb - 2;
    return nb;
  }
  if (--j < i) return 0;
  nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) {
      if (nb === 2) nb = 0;else self.lastNeed = nb - 3;
    }
    return nb;
  }
  return 0;
}

// Validates as many continuation bytes for a multi-byte UTF-8 character as
// needed or are available. If we see a non-continuation byte where we expect
// one, we "replace" the validated continuation bytes we've seen so far with
// UTF-8 replacement characters ('\ufffd'), to match v8's UTF-8 decoding
// behavior. The continuation byte check is included three times in the case
// where all of the continuation bytes for a character exist in the same buffer.
// It is also done this way as a slight performance increase instead of using a
// loop.
function utf8CheckExtraBytes(self, buf, p) {
  if ((buf[0] & 0xC0) !== 0x80) {
    self.lastNeed = 0;
    return '\ufffd'.repeat(p);
  }
  if (self.lastNeed > 1 && buf.length > 1) {
    if ((buf[1] & 0xC0) !== 0x80) {
      self.lastNeed = 1;
      return '\ufffd'.repeat(p + 1);
    }
    if (self.lastNeed > 2 && buf.length > 2) {
      if ((buf[2] & 0xC0) !== 0x80) {
        self.lastNeed = 2;
        return '\ufffd'.repeat(p + 2);
      }
    }
  }
}

// Attempts to complete a multi-byte UTF-8 character using bytes from a Buffer.
function utf8FillLast(buf) {
  var p = this.lastTotal - this.lastNeed;
  var r = utf8CheckExtraBytes(this, buf, p);
  if (r !== undefined) return r;
  if (this.lastNeed <= buf.length) {
    buf.copy(this.lastChar, p, 0, this.lastNeed);
    return this.lastChar.toString(this.encoding, 0, this.lastTotal);
  }
  buf.copy(this.lastChar, p, 0, buf.length);
  this.lastNeed -= buf.length;
}

// Returns all complete UTF-8 characters in a Buffer. If the Buffer ended on a
// partial character, the character's bytes are buffered until the required
// number of bytes are available.
function utf8Text(buf, i) {
  var total = utf8CheckIncomplete(this, buf, i);
  if (!this.lastNeed) return buf.toString('utf8', i);
  this.lastTotal = total;
  var end = buf.length - (total - this.lastNeed);
  buf.copy(this.lastChar, 0, end);
  return buf.toString('utf8', i, end);
}

// For UTF-8, a replacement character for each buffered byte of a (partial)
// character needs to be added to the output.
function utf8End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) return r + '\ufffd'.repeat(this.lastTotal - this.lastNeed);
  return r;
}

// UTF-16LE typically needs two bytes per character, but even if we have an even
// number of bytes available, we need to check if we end on a leading/high
// surrogate. In that case, we need to wait for the next two bytes in order to
// decode the last character properly.
function utf16Text(buf, i) {
  if ((buf.length - i) % 2 === 0) {
    var r = buf.toString('utf16le', i);
    if (r) {
      var c = r.charCodeAt(r.length - 1);
      if (c >= 0xD800 && c <= 0xDBFF) {
        this.lastNeed = 2;
        this.lastTotal = 4;
        this.lastChar[0] = buf[buf.length - 2];
        this.lastChar[1] = buf[buf.length - 1];
        return r.slice(0, -1);
      }
    }
    return r;
  }
  this.lastNeed = 1;
  this.lastTotal = 2;
  this.lastChar[0] = buf[buf.length - 1];
  return buf.toString('utf16le', i, buf.length - 1);
}

// For UTF-16LE we do not explicitly append special replacement characters if we
// end on a partial character, we simply let v8 handle that.
function utf16End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) {
    var end = this.lastTotal - this.lastNeed;
    return r + this.lastChar.toString('utf16le', 0, end);
  }
  return r;
}

function base64Text(buf, i) {
  var n = (buf.length - i) % 3;
  if (n === 0) return buf.toString('base64', i);
  this.lastNeed = 3 - n;
  this.lastTotal = 3;
  if (n === 1) {
    this.lastChar[0] = buf[buf.length - 1];
  } else {
    this.lastChar[0] = buf[buf.length - 2];
    this.lastChar[1] = buf[buf.length - 1];
  }
  return buf.toString('base64', i, buf.length - n);
}

function base64End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) return r + this.lastChar.toString('base64', 0, 3 - this.lastNeed);
  return r;
}

// Pass bytes on through for single-byte encodings (e.g. ascii, latin1, hex)
function simpleWrite(buf) {
  return buf.toString(this.encoding);
}

function simpleEnd(buf) {
  return buf && buf.length ? this.write(buf) : '';
}
},{"safe-buffer":220}],223:[function(require,module,exports){
(function (global){

/**
 * Module exports.
 */

module.exports = deprecate;

/**
 * Mark that a method should not be used.
 * Returns a modified function which warns once by default.
 *
 * If `localStorage.noDeprecation = true` is set, then it is a no-op.
 *
 * If `localStorage.throwDeprecation = true` is set, then deprecated functions
 * will throw an Error when invoked.
 *
 * If `localStorage.traceDeprecation = true` is set, then deprecated functions
 * will invoke `console.trace()` instead of `console.error()`.
 *
 * @param {Function} fn - the function to deprecate
 * @param {String} msg - the string to print to the console when `fn` is invoked
 * @returns {Function} a new "deprecated" version of `fn`
 * @api public
 */

function deprecate (fn, msg) {
  if (config('noDeprecation')) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (config('throwDeprecation')) {
        throw new Error(msg);
      } else if (config('traceDeprecation')) {
        console.trace(msg);
      } else {
        console.warn(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
}

/**
 * Checks `localStorage` for boolean values for the given `name`.
 *
 * @param {String} name
 * @returns {Boolean}
 * @api private
 */

function config (name) {
  // accessing global.localStorage can trigger a DOMException in sandboxed iframes
  try {
    if (!global.localStorage) return false;
  } catch (_) {
    return false;
  }
  var val = global.localStorage[name];
  if (null == val) return false;
  return String(val).toLowerCase() === 'true';
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[1]);
