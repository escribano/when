/** @license MIT License (c) copyright 2010-2013 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return function liftAll(api, liftOne, namer) {
		if(typeof namer !== 'function') {
			namer = namer === false ? identity : defaultNamer;
		}

		return Object.keys(api).reduce(function(lifted, key) {
			if(typeof api[key] === 'function') {
				lifted[namer(key)] = liftOne(api[key]);
			}
			return lifted;
		}, Object.create(api));
	};

	function defaultNamer(x) {
		return x + 'Async';
	}

	function identity(x) {
		return x;
	}
});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));
