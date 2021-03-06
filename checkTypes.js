/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

// assume we are bubbling this error upwards
function printWarning(text) {
	throw new Error(text);
};

function checkPropType(typeSpec, values, typeSpecName, location, componentName) {
	let error;
	// Prop type validation may throw. In case they do, we don't want to
	// fail the render phase where it didn't fail before. So we log it.
	// After these have been cleaned up, we'll let them throw.
	try {
		// This is intentionally an invariant that gets caught. It's the same
		// behavior as without this statement except with a better message.
		if (typeof typeSpec !== 'function') {
			const err = Error(
				`${componentName || 'Anonymous'}: ${location} type \`${typeSpecName
				}\` is invalid; it must be a function, usually from the "js-prop-types" package, but received \`${
				typeof typeSpec} \``);
			err.name = 'Invariant Violation';
			throw err;
		}
		error = typeSpec(values, typeSpecName, componentName, location, null);
	} catch (ex) {
		error = ex;
	}

	if (error instanceof Error) {
		// throw real exception
		printWarning(error.message);
	} else if (error) {
		// throw validation error
		printWarning(
			(componentName || 'Anonymous') + ': type specification of ' +
			location + ' `' + typeSpecName + '` is invalid; the type checker ' +
			'function must return `null` or an `Error` but returned a ' + typeof error + '. ' +
			'You may have forgotten to pass an argument to the type checker ' +
			'creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and ' +
			'shape all require an argument).'
		)
	}
}

/**
 * Assert that the values match with the type specs.
 * Error messages are memorized and will only be shown once.
 *
 * @param {object} typeSpecs Map of name to a ReactPropType
 * @param {object} values Runtime values that need to be type-checked
 * @param {string} location e.g. "prop", "context", "child context"
 * @param {string} componentName Name of the component for error messages.
 */
function checkPropTypes(typeSpecs, values, location = 'param', componentName = 'function') {
	for (const typeSpecName of Object.keys(typeSpecs)) {
		checkPropType(typeSpecs[typeSpecName], values, typeSpecName, location, componentName);
	}
	return true;
}

/**
 * Wrapper for checkPropTypes allowing for the evaluation of a single value
 */
function checkValueType(value, typeSpec, throws = true, location = 'param', componentName = 'function') {
	try {
		// { value: value } preserves any undefined refs
		checkPropType(typeSpec, { value: value }, 'value', location, componentName);
	} catch (e) {
		if (throws) throw e;
		return false;
	}

	return true;
}

module.exports = {
	checkPropTypes,
	checkValueType,
}
