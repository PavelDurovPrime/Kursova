'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { memoize } = require('../src/lib/memoization');

test('memoize caches value', () => {
  let calls = 0;
  const fn = memoize((x) => {
    calls += 1;
    return x * 2;
  });
  assert.equal(fn(2), 4);
  assert.equal(fn(2), 4);
  assert.equal(calls, 1);
});
