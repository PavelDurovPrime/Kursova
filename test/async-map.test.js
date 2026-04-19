'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { asyncMap } = require('../src/lib/async-array');

test('asyncMap maps values', async () => {
  const out = await asyncMap([1, 2, 3], async (x) => x + 1);
  assert.deepEqual(out, [2, 3, 4]);
});
