'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  fibonacciGenerator,
  consumeWithTimeout,
} = require('../src/lib/generators');

test('fibonacci first numbers', () => {
  const it = fibonacciGenerator(0, 1);
  assert.equal(it.next().value, 0);
  assert.equal(it.next().value, 1);
  assert.equal(it.next().value, 1);
});

test('consumeWithTimeout works', async () => {
  const it = fibonacciGenerator(1, 1);
  const summary = await consumeWithTimeout(it, 0.01);
  assert.ok(summary.iterations > 0);
});
