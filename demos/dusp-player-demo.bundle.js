(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
const DuspPlayer = require('../src/webaudioapi/DuspPlayer')

function addPlayer(destination=document.getElementById('players')) {
  let player = new DuspPlayer
  let div = player.htmlInterface()
  destination.appendChild(div)
}

window.onload = function() {
  addPlayer()
}


window.addPlayer = addPlayer

},{"../src/webaudioapi/DuspPlayer":172}],2:[function(require,module,exports){
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


},{"audio-context":5}],5:[function(require,module,exports){
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

},{}],6:[function(require,module,exports){
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

},{"validate.io-array":18,"validate.io-function":19,"validate.io-integer-array":20}],7:[function(require,module,exports){
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

},{"compute-gcd":6,"validate.io-array":18,"validate.io-function":19,"validate.io-integer-array":20}],8:[function(require,module,exports){
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

},{}],9:[function(require,module,exports){
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


},{}],10:[function(require,module,exports){
'use strict';

module.exports = require('./lib')

},{"./lib":15}],11:[function(require,module,exports){
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

},{"asap/raw":3}],12:[function(require,module,exports){
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

},{"./core.js":11}],13:[function(require,module,exports){
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

},{"./core.js":11}],14:[function(require,module,exports){
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

},{"./core.js":11}],15:[function(require,module,exports){
'use strict';

module.exports = require('./core.js');
require('./done.js');
require('./finally.js');
require('./es6-extensions.js');
require('./node-extensions.js');
require('./synchronous.js');

},{"./core.js":11,"./done.js":12,"./es6-extensions.js":13,"./finally.js":14,"./node-extensions.js":16,"./synchronous.js":17}],16:[function(require,module,exports){
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

},{"./core.js":11,"asap":2}],17:[function(require,module,exports){
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

},{"./core.js":11}],18:[function(require,module,exports){
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

},{}],19:[function(require,module,exports){
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

},{}],20:[function(require,module,exports){
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

},{"validate.io-array":18,"validate.io-integer":21}],21:[function(require,module,exports){
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

},{"validate.io-number":22}],22:[function(require,module,exports){
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

},{}],23:[function(require,module,exports){
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

},{"./config.js":99}],24:[function(require,module,exports){
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

},{"compute-gcd":6,"promise":10}],25:[function(require,module,exports){
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

},{"./config":99}],26:[function(require,module,exports){
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

},{"./Piglet.js":29,"./SignalChunk.js":30}],27:[function(require,module,exports){
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

},{"./Piglet.js":29}],28:[function(require,module,exports){
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

},{"./Event.js":25,"./UnitOrPatch.js":32}],29:[function(require,module,exports){
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

},{"./SignalChunk.js":30,"./config.js":99}],30:[function(require,module,exports){
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

},{}],31:[function(require,module,exports){
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

},{"./Circuit":24,"./Inlet.js":26,"./Outlet.js":27,"./UnitOrPatch.js":32,"./config.js":99}],32:[function(require,module,exports){
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

},{"./Event.js":25}],33:[function(require,module,exports){
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

},{"../Unit.js":31,"../config.js":99}],34:[function(require,module,exports){
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

},{"../Unit.js":31}],35:[function(require,module,exports){
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

},{"./CombFilter.js":40}],36:[function(require,module,exports){
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

},{"../Unit.js":31}],37:[function(require,module,exports){
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

},{"./CircleBufferNode.js":36}],38:[function(require,module,exports){
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

},{"./CircleBufferNode.js":36}],39:[function(require,module,exports){
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

},{"../Unit.js":31}],40:[function(require,module,exports){
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

},{"./FixedDelay.js":47}],41:[function(require,module,exports){
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

},{"../Unit.js":31}],42:[function(require,module,exports){
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

},{"../Unit.js":31}],43:[function(require,module,exports){
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

},{"../Unit.js":31}],44:[function(require,module,exports){
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

},{"../Unit.js":31,"../config.js":99}],45:[function(require,module,exports){
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

},{"../Unit.js":31}],46:[function(require,module,exports){
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

},{"../Unit.js":31}],47:[function(require,module,exports){
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

},{"../Unit.js":31}],48:[function(require,module,exports){
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

},{"../Unit.js":31}],49:[function(require,module,exports){
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

},{"../Unit.js":31}],50:[function(require,module,exports){
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

},{"../Unit.js":31}],51:[function(require,module,exports){
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

},{"../Unit.js":31}],52:[function(require,module,exports){
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

},{"../Unit.js":31}],53:[function(require,module,exports){
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

},{"../Unit.js":31}],54:[function(require,module,exports){
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

},{"../Unit.js":31}],55:[function(require,module,exports){
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

},{"../Unit.js":31}],56:[function(require,module,exports){
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

},{"../Unit.js":31}],57:[function(require,module,exports){
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

},{"../Unit.js":31,"../dusp":109}],58:[function(require,module,exports){
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

},{"../Unit.js":31}],59:[function(require,module,exports){
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

},{"../../Unit.js":31,"../../config.js":99,"./waveTables.js":62}],60:[function(require,module,exports){

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

},{"../../Unit.js":31,"./waveTables.js":62}],61:[function(require,module,exports){
module.exports = require("./Osc")
//module.exports.MultiChannelOsc = require("./MultiChannelOsc")

},{"./Osc":60}],62:[function(require,module,exports){
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

},{"../../config.js":99}],63:[function(require,module,exports){
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

},{"../Unit.js":31}],64:[function(require,module,exports){
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

},{"../Unit.js":31}],65:[function(require,module,exports){
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

},{"../Unit.js":31}],66:[function(require,module,exports){
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

},{"../Unit.js":31}],67:[function(require,module,exports){
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

},{"../Unit.js":31}],68:[function(require,module,exports){
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

},{"../Unit.js":31,"../config.js":99}],69:[function(require,module,exports){
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

},{"../Unit.js":31}],70:[function(require,module,exports){
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

},{"../Unit.js":31}],71:[function(require,module,exports){
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

},{"../Unit.js":31}],72:[function(require,module,exports){
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

},{"../Unit.js":31}],73:[function(require,module,exports){
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

},{"../Unit.js":31,"../config.js":99}],74:[function(require,module,exports){
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

},{"../Unit.js":31}],75:[function(require,module,exports){
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

},{"../../Unit.js":31,"../../config.js":99,"../Divide.js":45,"./shapeTables.js":76}],76:[function(require,module,exports){
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

},{"../../config.js":99}],77:[function(require,module,exports){
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

},{"../Unit.js":31}],78:[function(require,module,exports){
const Unit = require("../Unit.js")

class SporadicRetriggerer extends Unit {
  constructor(target, rate) {
    super()
    this.addInlet("rate", {mono:true, type:"frequency"})
    if(target)
      this.target = target
    this.RATE = rate || 1
  }

  _tick() {
    if(this._target && this._target.trigger)
      if(Math.random() < this.rate[0] * this.tickInterval / this.sampleRate)
        this._target.trigger()
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
module.exports = SporadicRetriggerer

},{"../Unit.js":31}],79:[function(require,module,exports){
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

},{"../Unit.js":31,"../config.js":99}],80:[function(require,module,exports){
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

},{"../config.js":99,"../dusp":109,"./SignalCombiner.js":77}],81:[function(require,module,exports){
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

},{"../Unit.js":31}],82:[function(require,module,exports){
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

},{"../Unit.js":31}],83:[function(require,module,exports){
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
	SporadicRetriggerer: require("./SporadicRetrigger.js"),
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
},{"./AHD.js":33,"./Abs.js":34,"./AllPass.js":35,"./CircleBufferNode.js":36,"./CircleBufferReader.js":37,"./CircleBufferWriter.js":38,"./Clip.js":39,"./CombFilter.js":40,"./ConcatChannels.js":41,"./CrossFader.js":42,"./DecibelToScaler.js":43,"./Delay.js":44,"./Divide.js":45,"./Filter.js":46,"./FixedDelay.js":47,"./FixedMultiply.js":48,"./Gain.js":49,"./GreaterThan.js":50,"./HardClipAbove.js":51,"./HardClipBelow.js":52,"./LessThan.js":53,"./MidiToFrequency.js":54,"./Monitor.js":55,"./MonoDelay.js":56,"./Multiply.js":57,"./Noise.js":58,"./Osc/MultiChannelOsc.js":59,"./Osc/Osc.js":60,"./Pan.js":63,"./PickChannel.js":64,"./PolarityInvert.js":65,"./Pow.js":66,"./Ramp.js":67,"./ReadBackDelay.js":68,"./Repeater.js":69,"./Rescale.js":70,"./Retriggerer.js":71,"./SampleRateRedux.js":72,"./SecondsToSamples.js":73,"./SemitoneToRatio.js":74,"./Shape/index.js":75,"./SignalCombiner.js":77,"./SporadicRetrigger.js":78,"./Subtract.js":79,"./Sum.js":80,"./Timer.js":81,"./VectorMagnitude.js":82,"./spectral/Augment.js":84,"./spectral/BinShift.js":85,"./spectral/FFT.js":86,"./spectral/HardHighPass.js":87,"./spectral/HardLowPass.js":88,"./spectral/Hopper.js":89,"./spectral/IFFT.js":90,"./spectral/ReChunk.js":91,"./spectral/SpectralGate.js":92,"./spectral/SpectralSum.js":93,"./spectral/SpectralUnit.js":94,"./spectral/UnHopper.js":95,"./spectral/Windower.js":96,"./vector/CircularMotion.js":97,"./vector/LinearMotion.js":98}],84:[function(require,module,exports){
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

},{"./SpectralUnit.js":94}],85:[function(require,module,exports){
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

},{"./SpectralUnit.js":94}],86:[function(require,module,exports){
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

},{"../../Unit.js":31,"fft.js":8}],87:[function(require,module,exports){
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

},{"./SpectralUnit.js":94}],88:[function(require,module,exports){
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

},{"./SpectralUnit.js":94}],89:[function(require,module,exports){
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

},{"../../Unit.js":31,"compute-gcd":6}],90:[function(require,module,exports){
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

},{"../../Unit.js":31,"fft.js":8}],91:[function(require,module,exports){
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

},{"../../Unit.js":31,"compute-gcd":6,"compute-lcm":7}],92:[function(require,module,exports){
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

},{"./SpectralUnit.js":94}],93:[function(require,module,exports){
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

},{"./SpectralUnit.js":94}],94:[function(require,module,exports){
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

},{"../../Unit.js":31,"../../config":99}],95:[function(require,module,exports){
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

},{"../../Unit.js":31}],96:[function(require,module,exports){
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

},{"../../Unit.js":31}],97:[function(require,module,exports){
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

},{"../../Unit.js":31,"../../config.js":99}],98:[function(require,module,exports){
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

},{"../../Unit.js":31,"../../config.js":99}],99:[function(require,module,exports){
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
},{"_process":175,"minimist":9}],100:[function(require,module,exports){
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

},{"../parseDSP/getExpression.js":116,"./constructNumber":101,"./constructObject":102,"./constructObjectProperty":103,"./constructObjectReference":104,"./constructOperation":105,"./constructShorthand":106,"./constructString":107}],101:[function(require,module,exports){
function constructNumber(o) {
  if(o.constructor == String)
    o = parseNumber(o)

  if(o.type != "number")
    return null

  return o.n
}

module.exports = constructNumber
const parseNumber = require("../parseDSP/getNumber.js")

},{"../parseDSP/getNumber.js":126}],102:[function(require,module,exports){


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

  let idTag = '#'+obj.label
  if(index[idTag]) {
    if(index[idTag] != obj)
      throw "Duplicate objects for id:", obj.label
  } else
    index[idTag] = obj

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

},{"../parseDSP/getObject.js":127,"../patchesAndComponents":168,"./constructExpression":100}],103:[function(require,module,exports){
function constructObjectProperty(o, index) {
  var obj = constructExpression(o.object, index)
  return obj[o.property]
}

module.exports = constructObjectProperty
const constructExpression = require("./constructExpression")

},{"./constructExpression":100}],104:[function(require,module,exports){
function constructObjectReference(o, index) {
  if(o.constructor == String)
    o = parseObjectReference(o)

  let hashTag = '#'+o.id
  if(index[hashTag])
    return index[hashTag]
  else
    throw "Error: Referencing an object which has not been declared: #"+o.id
}
module.exports = constructObjectReference

const parseObjectReference = require("../parseDSP/getObjectReference.js")

},{"../parseDSP/getObjectReference.js":129}],105:[function(require,module,exports){
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

    case "!": // regular retrigger
      if(!a.stop || !a.trigger)
        throw "invalid use of '!' operator"
      a.trigger()
      new components.Retriggerer(a, b)
      return a

    case "~!": // SporadicRetriggerer
      if(!a.stop || !a.trigger)
        throw "invalide use of '!~' operator"
      new components.SporadicRetriggerer(a, b)
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

},{"../components":83,"../components/Repeater.js":69,"../quick":169,"./constructExpression":100}],106:[function(require,module,exports){
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

},{"../parseDSP/getShorthand.js":132,"../patchesAndComponents":168,"./constructNumber":101,"./shorthandConstructors":108}],107:[function(require,module,exports){
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

},{"../parseDSP/getString.js":134}],108:[function(require,module,exports){
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

},{"../components":83}],109:[function(require,module,exports){
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

},{"./config.js":99}],110:[function(require,module,exports){
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
    "~!",
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

  shorthandConstructors: ["O", "Z", "Sq", "A", "D", "t", "random", "LP", "AP", "HP"]
}

const components = require("../patchesAndComponents")
for(var constr in components)
  module.exports.shorthandConstructors.push(constr)

},{"../patchesAndComponents":168}],111:[function(require,module,exports){
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

},{}],112:[function(require,module,exports){
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

},{}],113:[function(require,module,exports){
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

},{"./getAttribute":114,"./getExpression":116,"./getObjectReference.js":129,"./getWord.js":135}],114:[function(require,module,exports){
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

},{"./countWhitespace":111,"./getExpression.js":116,"./getWord.js":135}],115:[function(require,module,exports){
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

},{"./getWord":135,"./skipWhitespace":137}],116:[function(require,module,exports){
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

  var variable = getVariable(str, startIndex)
  if(variable)
    return variable

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

},{"./getJSON":124,"./getNumber.js":126,"./getObjectOrObjectProperty":128,"./getObjectReference.js":129,"./getOperatorOperand":131,"./getShorthand":132,"./getString":134,"./skipWhitespace":137}],117:[function(require,module,exports){
arguments[4][112][0].apply(exports,arguments)
},{"dup":112}],118:[function(require,module,exports){
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

},{"./index.js":124,"./skipWhitespace":125}],119:[function(require,module,exports){
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

},{"./findCoordinate":117}],120:[function(require,module,exports){
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

},{"./getProperty":121,"./skipWhitespace.js":125}],121:[function(require,module,exports){
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

},{"./getNumber":119,"./getString":122,"./getWord.js":123,"./index.js":124,"./skipWhitespace":125}],122:[function(require,module,exports){
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

},{}],123:[function(require,module,exports){

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

},{"./findCoordinate":117}],124:[function(require,module,exports){
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

},{"./getArray":118,"./getNumber":119,"./getObject":120,"./getString":122}],125:[function(require,module,exports){
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

},{}],126:[function(require,module,exports){
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

},{}],127:[function(require,module,exports){
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

},{"./countWhitespace":111,"./getArgument":113,"./getWord":135,"./skipWhitespace.js":137}],128:[function(require,module,exports){
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

},{"./getDotProperty":115,"./getObject":127,"./getObjectReference":129,"./getShorthand":132}],129:[function(require,module,exports){
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

},{"./getWordWithDigits.js":136}],130:[function(require,module,exports){
function getOperator(str, i0=0) {
  var winner = ""
  for(var i in operators) {
    var operator = getSpecific(operators[i], str, i0)
    if(operator && operator.length > winner.length)
      winner = operator
  }
  if(winner.length) {
    console.log("Got operator:", winner)
    return winner
  } else
    return null
}

module.exports = getOperator
const {operators} = require("./config")
const getSpecific = require("./getSpecific")

},{"./config":110,"./getSpecific":133}],131:[function(require,module,exports){
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

},{"./config":110,"./getExpression.js":116,"./getOperator":130,"./skipWhitespace.js":137}],132:[function(require,module,exports){
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

},{"./config":110,"./getNumber":126,"./getWord":135}],133:[function(require,module,exports){
function getSpecific(searchStr, str, i0) {
  i0 = i0 || 0
  for(var i=0; i<searchStr.length; i++)
    if(str[i + i0] != searchStr[i])
      return null

  return searchStr
}
module.exports = getSpecific

},{}],134:[function(require,module,exports){
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

},{}],135:[function(require,module,exports){
arguments[4][123][0].apply(exports,arguments)
},{"./findCoordinate":112,"dup":123}],136:[function(require,module,exports){

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

},{}],137:[function(require,module,exports){
arguments[4][125][0].apply(exports,arguments)
},{"dup":125}],138:[function(require,module,exports){
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

},{"../Patch.js":28,"../components/AllPass.js":35}],139:[function(require,module,exports){
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

},{"../Patch":28,"../components/AllPass.js":35,"./AttenuationMatrix.js":140}],140:[function(require,module,exports){
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

},{"../Patch.js":28,"./Mixer.js":152}],141:[function(require,module,exports){
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

},{"../Patch.js":28,"../components/Filter.js":46}],142:[function(require,module,exports){
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

},{"../Patch.js":28,"../components/Multiply.js":57,"../components/Osc":61,"../components/Shape":75}],143:[function(require,module,exports){
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

},{"../Patch.js":28,"../components/Multiply.js":57,"../components/Repeater.js":69,"../components/vector/CircularMotion.js":97}],144:[function(require,module,exports){
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

},{"../CircleBuffer.js":23,"../Patch":28,"../components/CircleBufferReader.js":37,"../components/CircleBufferWriter.js":38,"../quick.js":169}],145:[function(require,module,exports){
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

},{"../Patch.js":28,"../components/Multiply.js":57,"../components/Osc/MultiChannelOsc":59,"../components/Repeater.js":69,"../components/SemitoneToRatio.js":74}],146:[function(require,module,exports){

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

},{"../components/Shape":75,"../dusp":109,"../patches/FMOsc":145,"../quick.js":169,"../unDusp":171,"./FrequencyGroup.js":147,"./Mixer.js":152,"./StereoDetune.js":162,"./Synth.js":164,"./Worm.js":166}],147:[function(require,module,exports){
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

},{"../Patch.js":28,"../components/Repeater.js":69,"../quick.js":169}],148:[function(require,module,exports){
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

},{"../Patch.js":28,"../components/spectral/HardHighPass.js":87,"../components/spectral/HardLowPass.js":88}],149:[function(require,module,exports){
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

},{"../Patch.js":28,"../components/Multiply.js":57,"../components/Osc":61,"../components/Sum.js":80}],150:[function(require,module,exports){
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

},{"../Patch.js":28,"../components/Multiply.js":57,"../components/Osc":61,"../components/Repeater.js":69,"../components/Sum.js":80,"./StereoOsc":163}],151:[function(require,module,exports){
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

},{"../Patch.js":28,"../components/MidiToFrequency.js":54,"../components/Osc":61}],152:[function(require,module,exports){
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

},{"../Patch.js":28,"../components/Gain.js":49,"../components/Multiply.js":57,"../components/Repeater.js":69,"../components/Sum.js":80}],153:[function(require,module,exports){
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

},{"../CircleBuffer.js":23,"../Patch.js":28,"../components/CircleBufferReader.js":37,"../components/CircleBufferWriter.js":38,"../quick.js":169}],154:[function(require,module,exports){
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

},{"../Patch.js":28,"../components/Osc":61,"./ComplexOrbit.js":143,"./MidiOsc":151,"./Space.js":159}],155:[function(require,module,exports){
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

},{"../Patch.js":28,"../components/Multiply.js":57,"../components/Repeater.js":69,"./Space.js":159}],156:[function(require,module,exports){
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

},{"../Patch.js":28,"../components/CrossFader.js":42,"../components/Delay.js":44,"../components/Multiply.js":57,"../components/Repeater.js":69,"../components/SecondsToSamples.js":73,"../components/Sum.js":80}],157:[function(require,module,exports){
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

},{"../Patch.js":28,"../components/Multiply.js":57,"../components/Ramp.js":67,"../components/Shape":75,"../config.js":99,"../patches/MidiOsc":151}],158:[function(require,module,exports){
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

},{"../Patch.js":28,"../components/Multiply.js":57,"../components/Repeater.js":69,"./Mixer.js":152,"./OrbittySine.js":154}],159:[function(require,module,exports){
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

},{"../Patch.js":28,"../components/ConcatChannels.js":41,"../components/PickChannel.js":64,"../components/Repeater.js":69,"../config.js":99,"./SpaceChannel.js":161}],160:[function(require,module,exports){
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

},{"../Patch.js":28,"../components/Divide.js":45,"../components/MidiToFrequency.js":54,"../components/Multiply.js":57,"../components/Osc":61,"../components/Shape":75,"../config.js":99,"../patches/Space.js":159}],161:[function(require,module,exports){
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

},{"../Patch.js":28,"../components/Gain.js":49,"../components/MonoDelay.js":56,"../components/Multiply.js":57,"../components/Subtract.js":79,"../components/VectorMagnitude.js":82,"../config.js":99}],162:[function(require,module,exports){
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

},{"../Patch.js":28,"../components/Multiply.js":57,"../quick.js":169}],163:[function(require,module,exports){
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

},{"../Patch.js":28,"../components/Gain.js":49,"../components/MidiToFrequency.js":54,"../components/Osc":61,"../components/Pan.js":63,"../components/Sum.js":80}],164:[function(require,module,exports){
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

},{"../Patch.js":28}],165:[function(require,module,exports){
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

},{"../Patch.js":28,"./Mixer.js":152}],166:[function(require,module,exports){
const Patch = require("../Patch.js")
const Noise = require("../components/Noise")
const Filter = require("../components/Filter.js")
const Repeater = require("../components/Repeater.js")
const quick = require("../quick.js")

class Worm extends Patch {
  constructor(f=1) {
    super()

    this.addUnits(
      this.noise = new Noise(),
      this.filter = new Filter(this.noise, f)
    )

    this.aliasInlet(this.filter.F)
    this.aliasOutlet(this.filter.OUT)

    this.F = f
  }

  static random(fMax = 5) {
    var f = quick.multiply(fMax, Math.random())
    return new Worm(f)
  }
}
module.exports = Worm

},{"../Patch.js":28,"../components/Filter.js":46,"../components/Noise":58,"../components/Repeater.js":69,"../quick.js":169}],167:[function(require,module,exports){
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
},{"./APStack.js":138,"./APWeb.js":139,"./AttenuationMatrix.js":140,"./BandFilter.js":141,"./Boop.js":142,"./ComplexOrbit.js":143,"./DelayMixer.js":144,"./FMOsc.js":145,"./FMSynth.js":146,"./FrequencyGroup.js":147,"./HardBandPass.js":148,"./LFO.js":149,"./ManyOsc.js":150,"./MidiOsc.js":151,"./Mixer.js":152,"./MultiTapDelay.js":153,"./OrbittySine.js":154,"./ScaryPatch.js":155,"./SimpleDelay.js":156,"./SineBoop.js":157,"./SineCloud.js":158,"./Space.js":159,"./SpaceBoop.js":160,"./SpaceChannel.js":161,"./StereoDetune.js":162,"./StereoOsc.js":163,"./Synth.js":164,"./TriggerGroup.js":165,"./Worm.js":166}],168:[function(require,module,exports){
const patches = require("./patches")
const components = require("./components")

for(var name in patches)
  if(components[name])
    console.warn("A component and a patch with a common name:", name, "\nthe component will be overwritten")

Object.assign(exports, components, patches)

},{"./components":83,"./patches":167}],169:[function(require,module,exports){
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

},{"./components/ConcatChannels.js":41,"./components/Divide.js":45,"./components/HardClipAbove.js":51,"./components/HardClipBelow.js":52,"./components/Multiply.js":57,"./components/PolarityInvert.js":65,"./components/Pow.js":66,"./components/SemitoneToRatio.js":74,"./components/Subtract.js":79,"./components/Sum.js":80}],170:[function(require,module,exports){
const AudioBuffer = require('audio-buffer')
const Circuit = require('./Circuit')

// render audio into an channelData (array of typed arrays)
async function renderChannelData(outlet,
                                 duration=1,
                                 { TypedArray = Float32Array,
                                   normalise = false, // (unimplemented)
                                   audioctx = null,
                                 } = {}) {
  // check arguments
  if(!outlet)
    throw "renderAudioBuffer expects an outlet"
  if(outlet.isUnit || outlet.isPatch)
    outlet = outlet.defaultOutlet
  if(!outlet.isOutlet)
    throw "renderAudioBuffer expects an outlet"

  // find or construct the circuit
  const circuit = outlet.unit.circuit || new Circuit(outlet.unit)

  // get values
  const sampleRate = outlet.sampleRate
  const lengthInSamples = duration * sampleRate
  const chunkSize = outlet.chunkSize

  const channelData = [] // record data; channelData[channel][timeInSamples]

  for(let t0=0; t0<lengthInSamples; t0+=chunkSize) {
    // "tick" the circuit
    let t1 = t0 + chunkSize
    await circuit.tickUntil(t1)

    // the output signal chunk
    let chunk = outlet.signalChunk

    // increase numberOfChannels to accomodate output signal chunk
    while(chunk.channelData.length > channelData.length)
      channelData.push(new TypedArray(lengthInSamples))

    // record signal chunk to channelData
    for(let channel in chunk.channelData)
      for(let t=0; t<chunkSize; t++)
        channelData[channel][t+t0] = chunk.channelData[channel][t] || 0
  }

  channelData.sampleRate = sampleRate
  return channelData
}

module.exports = renderChannelData

},{"./Circuit":24,"audio-buffer":4}],171:[function(require,module,exports){
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

},{"./construct/constructExpression.js":100}],172:[function(require,module,exports){
const unDusp = require("../unDusp")
const renderAudioBuffer = require('./renderAudioBuffer')

const openBracketReg = /[\[\(\{]/

class DuspPlayer {
  constructor() {
    this.nowPlayingSource = null
    this.ctx = new AudioContext
  }

  async play(loop=false) {
    this.stop()

    let duspStr = this.interface.dusp.value
    let duration = parseDuration(this.interface.duration.value)

    let outlet = unDusp(duspStr, duration)
    if(!outlet)
      throw "Error in the dusp"

    let buffer = await renderAudioBuffer(outlet, duration)

    let source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.loop = loop
    source.connect(this.ctx.destination)
    source.start()
    source.onended = () => this.stop()

    console.log('playing', buffer, source)

    this.nowPlayingSource = source
    this.looping = loop

    this.updateButtons()
  }

  stop() {
    if(this.nowPlayingSource)
      this.nowPlayingSource.stop()
    this.nowPlayingSource = null
    this.looping = null
    this.updateButtons()
  }

  htmlInterface() {
    if(!document)
      throw "DuspPlayer cannot generate HTML interface outside of browser"
    if(this.interface)
      return this.interface

    let mainDIV = document.createElement('div')
    mainDIV.addEventListener('keydown', (e) => {
      if(e.metaKey && e.keyCode == 13) {
        this.play(e.shiftKey)
      } else if(e.keyCode == 27)
        this.stop()

    })
    mainDIV.className = 'DuspPlayer'

    let inputWrapperDIV = document.createElement('div')
    inputWrapperDIV.className = 'inputwrapper'
    mainDIV.appendChild(inputWrapperDIV)

    let duspINPUT = document.createElement('textarea')
    duspINPUT.addEventListener('keydown', function(e) {
      if(e.keyCode == 9) {
        e.preventDefault()
        var s = this.selectionStart;
        this.value = this.value.substring(0,this.selectionStart) + "  " + this.value.substring(this.selectionEnd);
        this.selectionEnd = s+2;
      }

      if(e.key == '(') {
        e.preventDefault()
        let s = this.selectionStart
        let t = this.selectionEnd
        this.value = this.value.substring(0, s) +
          '(' + this.value.substring(s,t) +
          ')' + this.value.substring(t)

        this.setSelectionRange(s+1, t+1)
      }

      if(e.key == '[') {
        e.preventDefault()
        let s = this.selectionStart
        let t = this.selectionEnd
        this.value = this.value.substring(0, s) +
          '[' + this.value.substring(s,t) +
          ']' + this.value.substring(t)

        this.setSelectionRange(s+1, t+1)
      }
      if(e.key == '\"') {
        e.preventDefault()
        let s = this.selectionStart
        let t = this.selectionEnd
        this.value = this.value.substring(0, s) +
          '"' + this.value.substring(s,t) +
          '"' + this.value.substring(t)

        this.setSelectionRange(s+1, t+1)
      }

      if(e.keyCode == 8) {
        // backspace

      }

      if(e.keyCode == 13 && !e.metaKey) {
        e.preventDefault()
        let s = this.selectionStart;
        let t = this.selectionEnd

        let before = this.value.substring(0,s)
        let line = before.slice(before.lastIndexOf('\n'))
        let nSpace = 0
        for(let i=before.lastIndexOf('\n')+1; i<before.length; i++, nSpace++)
          if(before[i] != ' ')
            break

        if(openBracketReg.test(before[before.length-1]))
          nSpace += 2

        let tabs = ' '.repeat(nSpace)
        this.value = before + '\n' + tabs + this.value.substring(t)
        this.selectionEnd = s+1+tabs.length
      }
    })
    duspINPUT.value = 'O200'
    inputWrapperDIV.appendChild(duspINPUT)

    let controlDIV = document.createElement('div')
    controlDIV.className = 'controls'
    mainDIV.appendChild(controlDIV)

    let durationLABEL = document.createElement('label')
    durationLABEL.innerText = 'duration:'
    controlDIV.appendChild(durationLABEL)

    let durationINPUT = document.createElement('input')
    durationINPUT.value = formatDuration(5)
    durationINPUT.onclick = function() {
      this.setSelectionRange(0, this.value.length)
    }
    durationINPUT.onblur = () => {
      durationINPUT.value = formatDuration(parseDuration(durationINPUT.value))
    }
    controlDIV.appendChild(durationINPUT)


    let playBTN = document.createElement('button')
    playBTN.innerText = 'play'
    playBTN.onclick = () => this.play(false)
    controlDIV.appendChild(playBTN)

    let stopBTN = document.createElement('button')
    stopBTN.innerText = 'stop'
    stopBTN.onclick = () => this.stop()
    controlDIV.appendChild(stopBTN)

    let loopBTN = document.createElement('button')
    loopBTN.innerText = 'play looped'
    loopBTN.onclick = () => this.play(true)
    controlDIV.appendChild(loopBTN)

    this.interface = {
      main: mainDIV,
      dusp: duspINPUT,
      duration: durationINPUT,
      play: playBTN,
      loop: loopBTN,
      stop: stopBTN,
    }

    this.updateButtons()

    return this.interface.main
  }

  updateButtons() {
    this.interface.play.className = 'inactive'
    this.interface.loop.className = 'inactive'
    this.interface.stop.className = 'inactive'
    if(this.nowPlayingSource) {
      if(this.looping)
        this.interface.loop.className = 'active'
      else
        this.interface.play.className = 'active'
    } else
      this.interface.stop.className = 'active'
  }
}
module.exports = DuspPlayer

function parseDuration(str) {
  let parts = str.split(':')
  if(parts.length == 2) {
    let minutes = parseInt(parts[0]) || 0
    let seconds = parseFloat(parts[1]) || 0
    return minutes*60 + seconds
  } else if(parts.length == 1) {
    return parseFloat(parts[0])
  }
}
function formatDuration(seconds) {
  let minutes = Math.floor(seconds/60).toString()
  if(minutes.length == 1)
    minutes = '0'+minutes
  seconds -= minutes * 60
  seconds = (Math.abs(seconds) < 10 ? '0' : '') + seconds.toFixed(3)
  return minutes + ":" + seconds
}

},{"../unDusp":171,"./renderAudioBuffer":174}],173:[function(require,module,exports){
const AudioBuffer = require('audio-buffer')

function channelDataToAudioBuffer(channelData) {
  let audioBuffer = new AudioBuffer({
    sampleRate: channelData.sampleRate,
    numberOfChannels: channelData.length,
    length: channelData[0].length,
  })

  for(let c=0; c<channelData.length; c++) {
    audioBuffer.copyToChannel(channelData[c], c)
  }

  return audioBuffer
}
module.exports = channelDataToAudioBuffer

},{"audio-buffer":4}],174:[function(require,module,exports){
const renderChannelData = require('../renderChannelData')
const channelDataToAudioBuffer = require('./channelDataToAudioBuffer')

async function renderAudioBuffer(outlet, duration, options={}) {
  let channelData = await renderChannelData(outlet, duration, options)
  return channelDataToAudioBuffer(channelData)
}
module.exports = renderAudioBuffer

},{"../renderChannelData":170,"./channelDataToAudioBuffer":173}],175:[function(require,module,exports){
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

},{}]},{},[1]);
