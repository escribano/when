/** @license MIT License (c) copyright 2013-2014 original author or authors */

/**
 * Collection of helper functions for wrapping and executing 'traditional'
 * synchronous functions in a promise interface.
 *
 * @author Brian Cavalier
 * @contributor Renato Zannon
 */

(function(define) {
define(function(require) {

	var when, slice, tryCall, _liftAll;

	when = require('./when');
	tryCall = when['try'];
	_liftAll = require('./lib/liftAll');
	slice = Array.prototype.slice;

	return {
		lift: lift,
		liftAll: liftAll,
		call: tryCall,
		apply: apply,
		compose: compose
	};

	/**
	 * Takes a function and an optional array of arguments (that might be promises),
	 * and calls the function. The return value is a promise whose resolution
	 * depends on the value returned by the function.
	 * @param {function} func function to be called
	 * @param {Array} [args] array of arguments to func
	 * @returns {Promise} promise for the return value of func
	 */
	function apply(func, promisedArgs) {
		return arguments.length > 1
			? tryCall.apply(this, [func].concat(promisedArgs))
			: tryCall.call(this, func);
	}

	/**
	 * Takes a 'regular' function and returns a version of that function that
	 * returns a promise instead of a plain value, and handles thrown errors by
	 * returning a rejected promise. Also accepts a list of arguments to be
	 * prepended to the new function, as does Function.prototype.bind.
	 *
	 * The resulting function is promise-aware, in the sense that it accepts
	 * promise arguments, and waits for their resolution.
	 * @param {Function} func function to be bound
	 * @param {...*} [args] arguments to be prepended for the new function
	 * @returns {Function} a promise-returning function
	 */
	function lift(func /*, args... */) {
		var args = slice.call(arguments, 1);
		return function() {
			args.unshift(func);
			args.push.apply(args, slice.call(arguments));
			return tryCall.apply(this, args);
		};
	}

	function liftAll(targetObj, namer) {
		return _liftAll(targetObj, lift, namer);
	}

	/**
	 * Composes multiple functions by piping their return values. It is
	 * transparent to whether the functions return 'regular' values or promises:
	 * the piped argument is always a resolved value. If one of the functions
	 * throws or returns a rejected promise, the composed promise will be also
	 * rejected.
	 *
	 * The arguments (or promises to arguments) given to the returned function (if
	 * any), are passed directly to the first function on the 'pipeline'.
	 * @param {Function} f the function to which the arguments will be passed
	 * @param {...Function} [funcs] functions that will be composed, in order
	 * @returns {Function} a promise-returning composition of the functions
	 */
	function compose(f /*, funcs... */) {
		var funcs = slice.call(arguments, 1);

		return function() {
			var thisArg, args, firstPromise;

			thisArg = this;
			args = slice.call(arguments);
			firstPromise = when['try'].apply(thisArg, [f].concat(args));

			return when.reduce(funcs, function(arg, func) {
				return func.call(thisArg, arg);
			}, firstPromise);
		};
	}
});
})(typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(require); });


