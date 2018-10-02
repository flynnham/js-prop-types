# js-prop-types

This my own environment agnostic reworking of
[Facebook's React prop-types](https://github.com/facebook/prop-types) implementation.

This implementation allows type validation via thrown Type exceptions, which is
useful for type checking on primitive values outside of a React/Browser environment.

## Significant deviations from the original source

* Converted `type.isRequired` to `type.isOptional` to assume that all type
checks assume a value to be provided by default (and to throw if otherwise).

* Removal of unneeded React component support (since it's being used to validate
primitive values).

* [WIP] Replacement of ES5 compliant code and shims with their ES2015+ equivalents.

* Removal of unneeded files and old build process.
