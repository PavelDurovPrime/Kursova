'use strict';

const { EventEmitter } = require('node:events');

class EventBus {
  constructor() {
    this.emitter = new EventEmitter();
  }

  subscribe(eventName, handler) {
    this.emitter.on(eventName, handler);
    return () => this.emitter.off(eventName, handler);
  }

  publish(eventName, payload) {
    this.emitter.emit(eventName, payload);
  }
}

module.exports = { EventBus };
