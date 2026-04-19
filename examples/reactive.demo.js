'use strict';

const { EventBus } = require('../src/lib/reactive');

const bus = new EventBus();
const unsubscribe = bus.subscribe('message', (payload) => {
  console.log('received', payload);
});
bus.publish('message', { value: 1 });
unsubscribe();
