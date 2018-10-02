/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

const { checkPropTypes, checkValueType } = require('./checkTypes');

const has = Function.call.bind(Object.prototype.hasOwnProperty);

// warnings here are tentative and can be pushed to stderr instead
// of bubbling up
const printWarning = function(text) {
	const message = `Warning: ${text}`;
	console.error(message);
};

function emptyFunctionThatReturnsNull() {
	return null;
}

module.exports = function() {
	/* global Symbol */
	const ITERATOR_SYMBOL = typeof Symbol === 'function' && Symbol.iterator;
	const FAUX_ITERATOR_SYMBOL = '@@iterator'; // Before Symbol spec.

	/**
	 * Returns the iterator method function contained on the iterable object.
	 *
	 * Be sure to invoke the function with the iterable as context:
	 *
	 *     let iteratorFn = getIteratorFn(myIterable);
	 *     if (iteratorFn) {
	 *       let iterator = iteratorFn.call(myIterable);
	 *       ...
	 *     }
	 *
	 * @param {?object} maybeIterable
	 * @return {?function}
	 */
	function getIteratorFn(maybeIterable) {
		const iteratorFn = maybeIterable && (ITERATOR_SYMBOL && maybeIterable[ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL]);
		if (typeof iteratorFn === 'function') {
			return iteratorFn;
		}
	}

	const ANONYMOUS = '<<anonymous>>';

	const PropTypes = {
		array: createPrimitiveTypeChecker('array'),
		bool: createPrimitiveTypeChecker('boolean'),
		func: createPrimitiveTypeChecker('function'),
		number: createPrimitiveTypeChecker('number'),
		object: createPrimitiveTypeChecker('object'),
		string: createPrimitiveTypeChecker('string'),
		symbol: createPrimitiveTypeChecker('symbol'),

		any: createAnyTypeChecker(),
		arrayOf: createArrayOfTypeChecker,
		instanceOf: createInstanceTypeChecker,
		objectOf: createObjectOfTypeChecker,
		oneOf: createEnumTypeChecker,
		oneOfType: createUnionTypeChecker,
		shape: createShapeTypeChecker,
		exact: createStrictShapeTypeChecker,
	};

	/**
	 * We use an Error-like object for backward compatibility as people may call
	 * PropTypes directly and inspect their output. However, we don't use real
	 * Errors anymore. We don't inspect their stack anyway, and creating them
	 * is prohibitively expensive if they are created too often, such as what
	 * happens in oneOfType() for any type before the one that matched.
	 */
	function InternalTypeError(message) {
		this.message = message;
		this.stack = '';
	}
	// Make `instanceof Error` still work for returned errors.
	InternalTypeError.prototype = Error.prototype;

	function createChainableTypeChecker(validate) {
		function checkType(isRequired, props, propName, componentName, location, propFullName) {
			componentName = componentName || ANONYMOUS;
			propFullName = propFullName || propName;

			if (props[propName] == null) {
				if (isRequired) {
					if (props[propName] === null) {
						return new InternalTypeError('The ' + location + ' `' + propFullName + '` is marked as required ' + ('in `' + componentName + '`, but its value is `null`.'));
					}
					return new InternalTypeError('The ' + location + ' `' + propFullName + '` is marked as required in ' + ('`' + componentName + '`, but its value is `undefined`.'));
				}
				return null;
			} else {
				return validate(props, propName, componentName, location, propFullName);
			}
		}

		// assume instance is required by default
		const chainedCheckType = checkType.bind(null, true);
		chainedCheckType.isOptional = checkType.bind(null, false);

		return chainedCheckType;
	}

	function createPrimitiveTypeChecker(expectedType) {
		function validate(props, propName, componentName, location, propFullName, secret) {
			const propValue = props[propName];
			const propType = getPropType(propValue);
			if (propType !== expectedType) {
				// `propValue` being instance of, say, date/regexp, pass the 'object'
				// check, but we can offer a more precise error message here rather than
				// 'of type `object`'.
				const preciseType = getPreciseType(propValue);

				return new InternalTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + preciseType + '` supplied to `' + componentName + '`, expected ') + ('`' + expectedType + '`.'));
			}
			return null;
		}
		return createChainableTypeChecker(validate);
	}

	function createAnyTypeChecker() {
		return createChainableTypeChecker(emptyFunctionThatReturnsNull);
	}

	function createArrayOfTypeChecker(typeChecker) {
		function validate(props, propName, componentName, location, propFullName) {
			if (typeof typeChecker !== 'function') {
				return new InternalTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside arrayOf.');
			}
			const propValue = props[propName];

			if (!Array.isArray(propValue)) {
				const propType = getPropType(propValue);
				return new InternalTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an array.'));
			}

			for (let i = 0; i < propValue.length; i++) {
				const error = typeChecker(propValue, i, componentName, location, propFullName + '[' + i + ']');
				if (error instanceof Error) {
					return error;
				}
			}
			return null;
		}
		return createChainableTypeChecker(validate);
	}

	function createInstanceTypeChecker(expectedClass) {
		function validate(props, propName, componentName, location, propFullName) {
			if (!(props[propName] instanceof expectedClass)) {
				const expectedClassName = expectedClass.name || ANONYMOUS;
				const actualClassName = getClassName(props[propName]);
				return new InternalTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + actualClassName + '` supplied to `' + componentName + '`, expected ') + ('instance of `' + expectedClassName + '`.'));
			}
			return null;
		}
		return createChainableTypeChecker(validate);
	}

	function createEnumTypeChecker(expectedValues) {
		if (!Array.isArray(expectedValues)) {
			printWarning('Invalid argument supplied to oneOf, expected an instance of array.');
			return emptyFunctionThatReturnsNull;
		}

		function validate(props, propName, componentName, location, propFullName) {
			const propValue = props[propName];
			for (let i = 0; i < expectedValues.length; i++) {
				if (Object.is(propValue, expectedValues[i])) {
					return null;
				}
			}

			const valuesString = JSON.stringify(expectedValues);
			return new InternalTypeError('Invalid ' + location + ' `' + propFullName + '` of value `' + propValue + '` ' + ('supplied to `' + componentName + '`, expected one of ' + valuesString + '.'));
		}
		return createChainableTypeChecker(validate);
	}

	function createObjectOfTypeChecker(typeChecker) {
		function validate(props, propName, componentName, location, propFullName) {
			if (typeof typeChecker !== 'function') {
				return new InternalTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside objectOf.');
			}
			const propValue = props[propName];
			const propType = getPropType(propValue);
			if (propType !== 'object') {
				return new InternalTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an object.'));
			}
			for (const key in propValue) {
				if (has(propValue, key)) {
					const error = typeChecker(propValue, key, componentName, location, propFullName + '.' + key);
					if (error instanceof Error) {
						return error;
					}
				}
			}
			return null;
		}
		return createChainableTypeChecker(validate);
	}

	function createUnionTypeChecker(arrayOfTypeCheckers) {
		if (!Array.isArray(arrayOfTypeCheckers)) {
			printWarning('Invalid argument supplied to oneOfType, expected an instance of array.');
			return emptyFunctionThatReturnsNull;
		}

		for (let i = 0; i < arrayOfTypeCheckers.length; i++) {
			const checker = arrayOfTypeCheckers[i];
			if (typeof checker !== 'function') {
				printWarning(
					'Invalid argument supplied to oneOfType. Expected an array of check functions, but ' +
					'received ' + getPostfixForTypeWarning(checker) + ' at index ' + i + '.'
				);
				return emptyFunctionThatReturnsNull;
			}
		}

		function validate(props, propName, componentName, location, propFullName) {
			for (let i = 0; i < arrayOfTypeCheckers.length; i++) {
				const checker = arrayOfTypeCheckers[i];
				if (checker(props, propName, componentName, location, propFullName) == null) {
					return null;
				}
			}

			return new InternalTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`.'));
		}
		return createChainableTypeChecker(validate);
	}

	function createNodeChecker() {
		function validate(props, propName, componentName, location, propFullName) {
			if (!isNode(props[propName])) {
				return new InternalTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`, expected a ReactNode.'));
			}
			return null;
		}
		return createChainableTypeChecker(validate);
	}

	function createShapeTypeChecker(shapeTypes) {
		function validate(props, propName, componentName, location, propFullName) {
			const propValue = props[propName];
			const propType = getPropType(propValue);
			if (propType !== 'object') {
				return new InternalTypeError('Invalid ' + location + ' `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));
			}
			for (let key in shapeTypes) {
				const checker = shapeTypes[key];
				if (!checker) {
					continue;
				}
				const error = checker(propValue, key, componentName, location, propFullName + '.' + key);
				if (error) {
					return error;
				}
			}
			return null;
		}
		return createChainableTypeChecker(validate);
	}

	function createStrictShapeTypeChecker(shapeTypes) {
		function validate(props, propName, componentName, location, propFullName) {
			const propValue = props[propName];
			const propType = getPropType(propValue);
			if (propType !== 'object') {
				return new InternalTypeError('Invalid ' + location + ' `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));
			}
			// We need to check all keys in case some are required but missing from
			// props.
			const allKeys = Object.assign({}, props[propName], shapeTypes);
			for (let key in allKeys) {
				const checker = shapeTypes[key];
				if (!checker) {
					return new InternalTypeError(
						'Invalid ' + location + ' `' + propFullName + '` key `' + key + '` supplied to `' + componentName + '`.' +
						'\nBad object: ' + JSON.stringify(props[propName], null, '  ') +
						'\nValid keys: ' + JSON.stringify(Object.keys(shapeTypes), null, '  ')
					);
				}
				const error = checker(propValue, key, componentName, location, propFullName + '.' + key);
				if (error) {
					return error;
				}
			}
			return null;
		}

		return createChainableTypeChecker(validate);
	}

	function isNode(propValue) {
		switch (typeof propValue) {
			case 'number':
			case 'string':
			case 'undefined':
				return true;
			case 'boolean':
				return !propValue;
			case 'object':
				if (Array.isArray(propValue)) {
					return propValue.every(isNode);
				}
				if (propValue === null) {
					return true;
				}

				const iteratorFn = getIteratorFn(propValue);
				if (iteratorFn) {
					const iterator = iteratorFn.call(propValue);
					let step;
					if (iteratorFn !== propValue.entries) {
						while (!(step = iterator.next()).done) {
							if (!isNode(step.value)) {
								return false;
							}
						}
					} else {
						// Iterator will provide entry [k,v] tuples rather than values.
						while (!(step = iterator.next()).done) {
							const entry = step.value;
							if (entry) {
								if (!isNode(entry[1])) {
									return false;
								}
							}
						}
					}
				} else {
					return false;
				}

				return true;
			default:
				return false;
		}
	}

	function isSymbol(propType, propValue) {
		// Native Symbol.
		if (propType === 'symbol') {
			return true;
		}

		// 19.4.3.5 Symbol.prototype[@@toStringTag] === 'Symbol'
		if (propValue['@@toStringTag'] === 'Symbol') {
			return true;
		}

		// Fallback for non-spec compliant Symbols which are polyfilled.
		if (typeof Symbol === 'function' && propValue instanceof Symbol) {
			return true;
		}

		return false;
	}

	// Equivalent of `typeof` but with special handling for array and regexp.
	function getPropType(propValue) {
		const propType = typeof propValue;
		if (Array.isArray(propValue)) {
			return 'array';
		}
		if (propValue instanceof RegExp) {
			// Old webkits (at least until Android 4.0) return 'function' rather than
			// 'object' for typeof a RegExp. We'll normalize this here so that /bla/
			// passes PropTypes.object.
			return 'object';
		}
		if (isSymbol(propType, propValue)) {
			return 'symbol';
		}
		return propType;
	}

	// This handles more types than `getPropType`. Only used for error messages.
	// See `createPrimitiveTypeChecker`.
	function getPreciseType(propValue) {
		if (typeof propValue === 'undefined' || propValue === null) {
			return '' + propValue;
		}
		const propType = getPropType(propValue);
		if (propType === 'object') {
			if (propValue instanceof Date) {
				return 'date';
			} else if (propValue instanceof RegExp) {
				return 'regexp';
			}
		}
		return propType;
	}

	// Returns a string that is postfixed to a warning about an invalid type.
	// For example, "undefined" or "of type array"
	function getPostfixForTypeWarning(value) {
		const type = getPreciseType(value);
		switch (type) {
			case 'array':
			case 'object':
				return 'an ' + type;
			case 'boolean':
			case 'date':
			case 'regexp':
				return 'a ' + type;
			default:
				return type;
		}
	}

	// Returns class name of the object, if any.
	function getClassName(propValue) {
		if (!propValue.constructor || !propValue.constructor.name) {
			return ANONYMOUS;
		}
		return propValue.constructor.name;
	}

	PropTypes.checkPropTypes = checkPropTypes;
	PropTypes.checkValueType = checkValueType;
	PropTypes.PropTypes = PropTypes;

	return PropTypes;
};
