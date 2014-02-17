/** @license MIT License (c) copyright 2010-2014 original author or authors */

/**
 * A lightweight CommonJS Promises/A and when() implementation
 * when is part of the cujoJS family of libraries (http://cujojs.com/)
 * @author Brian Cavalier
 * @author John Hann
 * @version 3.0.0
 */
(function(define) { 'use strict';
define(function (require) {

	var timer = require('./lib/timer');
	var timed = require('./lib/timed');
	var array = require('./lib/array');
	var flow = require('./lib/flow');
	var inspect = require('./lib/inspect');
	var generate = require('./lib/iterate');
	var progress = require('./lib/progress');

	var Promise = require('./lib/Promise');
	Promise = [array, flow, generate, progress, inspect]
		.reduceRight(function(Promise, feature) {
			return feature(Promise);
		}, timed(timer.set, timer.clear, Promise));

	var resolve = Promise.resolve;
	var slice = Array.prototype.slice;

	// Public API

	when.promise     = promise;         // Create a pending promise
	when.resolve     = Promise.resolve; // Create a resolved promise
	when.reject      = Promise.reject;  // Create a rejected promise

	when.lift        = lift;            // lift a function to return promises
	when['try']      = tryCall;         // call a function and return a promise
	when.attempt     = tryCall;         // alias for when.try

	when.iterate     = Promise.iterate; // Generate a stream of promises
	when.unfold      = Promise.unfold;  // Generate a stream of promises

	when.join        = join;            // Join 2 or more promises

	when.all         = all;             // Resolve a list of promises
	when.map         = map;             // Array.map() for promises
	when.reduce      = reduce;          // Array.reduce() for promises
	when.reduceRight = reduceRight;     // Array.reduceRight() for promises
	when.settle      = settle;          // Settle a list of promises

	when.any         = any;             // One-winner race
	when.some        = some;            // Multi-winner race

	when.isPromise   = isPromiseLike;   // DEPRECATED: use isPromiseLike
	when.isPromiseLike = isPromiseLike; // Is something promise-like, aka thenable

	when.Promise   = Promise;           // Promise constructor
	when.defer     = defer;             // Create a {promise, resolve, reject} tuple

	/**
	 * Register an observer for a promise or immediate value.
	 *
	 * @param {*} promiseOrValue
	 * @param {function?} [onFulfilled] callback to be called when promiseOrValue is
	 *   successfully fulfilled.  If promiseOrValue is an immediate value, callback
	 *   will be invoked immediately.
	 * @param {function?} [onRejected] callback to be called when promiseOrValue is
	 *   rejected.
	 * @param {function?} [onProgress] callback to be called when progress updates
	 *   are issued for promiseOrValue.
	 * @returns {Promise} a new {@link Promise} that will complete with the return
	 *   value of callback or errback or the completion value of promiseOrValue if
	 *   callback and/or errback is not supplied.
	 */
	function when(promiseOrValue, onFulfilled, onRejected, onProgress) {
		return resolve(promiseOrValue).then(onFulfilled, onRejected, onProgress);
	}

	/**
	 * Creates a new promise whose fate is determined by resolver.
	 * @param {function} resolver function(resolve, reject, notify)
	 * @returns {Promise} promise whose fate is determine by resolver
	 */
	function promise(resolver) {
		return new Promise(resolver);
	}

	/**
	 * Call f in a future turn, with the supplied args, and return a promise
	 * for the result.
	 * @param {function} f
	 * @returns {Promise}
	 */
	function tryCall(f /*, args... */) {
		/*jshint validthis:true */
		return _apply(f, this, slice.call(arguments, 1));
	}

	/**
	 * Lift the supplied function, creating a version of f that returns
	 * promises, and accepts promises as arguments.
	 * @param {function} f
	 * @returns {Function} version of f that returns promises
	 */
	function lift(f) {
		return function() {
			return _apply(f, this, slice.call(arguments));
		};
	}

	/**
	 * try/lift helper that allows specifying thisArg
	 * @private
	 */
	function _apply(func, thisArg, args) {
		return Promise.all(args).then(function(args) {
			return func.apply(thisArg, args);
		});
	}

	/**
	 * Creates a {promise, resolver} pair, either or both of which
	 * may be given out safely to consumers.
	 * The resolver has resolve, reject, and progress.  The promise
	 * has then plus extended promise API.
	 *
	 * @return {{
	 * promise: Promise,
	 * resolve: function:Promise,
	 * reject: function:Promise,
	 * notify: function:Promise
	 * }}
	 */
	function defer() {
		// Optimize object shape
		var deferred = {
			promise: void 0,
			resolve: void 0, reject: void 0, notify: void 0,
			resolver: { resolve: void 0, reject: void 0, notify: void 0 }
		};

		deferred.promise = new Promise(makeDeferred);

		return deferred;

		function makeDeferred(resolvePending, rejectPending, notifyPending) {
			deferred.resolve = deferred.resolver.resolve = resolvePending;
			deferred.reject  = deferred.resolver.reject  = rejectPending;
			deferred.notify  = deferred.resolver.notify  = notifyPending;
		}
	}

	/**
	 * Determines if x is promise-like, i.e. a thenable object
	 * NOTE: Will return true for *any thenable object*, and isn't truly
	 * safe, since it may attempt to access the `then` property of x (i.e.
	 *  clever/malicious getters may do weird things)
	 * @param {*} x anything
	 * @returns {boolean} true if x is promise-like
	 */
	function isPromiseLike(x) {
		return x && typeof x.then === 'function';
	}

	/**
	 * Initiates a competitive race, returning a promise that will resolve when
	 * howMany of the supplied promisesOrValues have resolved, or will reject when
	 * it becomes impossible for howMany to resolve, for example, when
	 * (promisesOrValues.length - howMany) + 1 input promises reject.
	 *
	 * @param {Array} promises array of anything, may contain a mix
	 *      of promises and values
	 * @param howMany {number} number of promisesOrValues to resolve
	 * @returns {Promise} promise that will resolve to an array of howMany values that
	 *  resolved first, or will reject with an array of
	 *  (promisesOrValues.length - howMany) + 1 rejection reasons.
	 */
	function some(promises, howMany) {
		return when(promises, function(array) {
			return Promise.some(array, howMany);
		});
	}

	/**
	 * Initiates a competitive race, returning a promise that will resolve when
	 * any one of the supplied promisesOrValues has resolved or will reject when
	 * *all* promisesOrValues have rejected.
	 *
	 * @param {Array|Promise} promises array of anything, may contain a mix
	 *      of {@link Promise}s and values
	 * @returns {Promise} promise that will resolve to the value that resolved first, or
	 * will reject with an array of all rejected inputs.
	 */
	function any(promises) {
		return when(promises, Promise.any);
	}

	/**
	 * Return a promise that will resolve only once all the supplied promises
	 * have resolved. The resolution value of the returned promise will be an array
	 * containing the resolution values of each of the promises.
	 * @param {Array|Promise} promises array of anything, may contain a mix
	 *      of promises and values
	 * @returns {Promise}
	 */
	function all(promises) {
		return when(promises, Promise.all);
	}

	/**
	 * Return a promise that will resolve only once all the supplied arguments
	 * have resolved. The resolution value of the returned promise will be an array
	 * containing the resolution values of each of the arguments.
	 * @param {...*} arguments may be a mix of promises and values
	 * @returns {Promise}
	 */
	function join(/* ...promises */) {
		return all(slice.call(arguments));
	}

	/**
	 * Settles all input promises such that they are guaranteed not to
	 * be pending once the returned promise fulfills. The returned promise
	 * will always fulfill, except in the case where `array` is a promise
	 * that rejects.
	 * @param {Array|Promise} promises or promise for array of promises to settle
	 * @returns {Promise} promise that always fulfills with an array of
	 *  outcome snapshots for each input promise.
	 */
	function settle(promises) {
		return when(promises, Promise.settle);
	}

	/**
	 * Promise-aware array map function, similar to `Array.prototype.map()`,
	 * but input array may contain promises or values.
	 * @param {Array|Promise} promises array of anything, may contain promises and values
	 * @param {function} mapFunc map function which may return a promise or value
	 * @returns {Promise} promise that will fulfill with an array of mapped values
	 *  or reject if any input promise rejects.
	 */
	function map(promises, mapFunc) {
		return when(promises, function(promises) {
			return Promise.map(promises, mapFunc);
		});
	}

	/**
	 * Traditional reduce function, similar to `Array.prototype.reduce()`, but
	 * input may contain promises and/or values, and reduceFunc
	 * may return either a value or a promise, *and* initialValue may
	 * be a promise for the starting value.
	 *
	 * @param {Array|Promise} promises array or promise for an array of anything,
	 *      may contain a mix of promises and values.
	 * @param {function} f reduce function reduce(currentValue, nextValue, index)
	 * @returns {Promise} that will resolve to the final reduced value
	 */
	function reduce(promises, f /*, initialValue */) {
		/*jshint unused:false*/
		var args = slice.call(arguments, 1);
		return when(promises, function(array) {
			args.unshift(array);
			return Promise.reduce.apply(Promise, args);
		});
	}

	/**
	 * Traditional reduce function, similar to `Array.prototype.reduceRight()`, but
	 * input may contain promises and/or values, and reduceFunc
	 * may return either a value or a promise, *and* initialValue may
	 * be a promise for the starting value.
	 *
	 * @param {Array|Promise} promises array or promise for an array of anything,
	 *      may contain a mix of promises and values.
	 * @param {function} f reduce function reduce(currentValue, nextValue, index)
	 * @returns {Promise} that will resolve to the final reduced value
	 */
	function reduceRight(promises, f /*, initialValue */) {
		/*jshint unused:false*/
		var args = slice.call(arguments, 1);
		return when(promises, function(array) {
			args.unshift(array);
			return Promise.reduceRight.apply(Promise, args);
		});
	}

	return when;
});
})(typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(require); });
