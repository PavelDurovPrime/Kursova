'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventBus } = require('../src/lib/reactive');

test('event bus subscribe and publish', () => {
  const bus = new EventBus();
  let seen = 0;
  const unsubscribe = bus.subscribe('x', () => {
    seen += 1;
  });
  bus.publish('x', {});
  unsubscribe();
  bus.publish('x', {});
  assert.equal(seen, 1);
});
