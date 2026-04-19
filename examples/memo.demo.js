'use strict';

const { memoize } = require('../src/lib/memoization');

const square = memoize((value) => value * value, {
  maxSize: 3,
  ttlMs: 2000,
});

console.log(square(3));
console.log(square(3));
console.log(square(4));
