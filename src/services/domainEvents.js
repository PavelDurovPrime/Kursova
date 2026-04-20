'use strict';

const { EventBus } = require('../lib/reactive');

const bus = new EventBus();
const recentEvents = [];
const MAX_RECENT_EVENTS = 100;

function publishDomainEvent(eventName, payload) {
  const event = {
    eventName,
    payload,
    timestamp: new Date().toISOString(),
  };
  recentEvents.push(event);
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.shift();
  }
  bus.publish(eventName, event);
}

function subscribeDomainEvent(eventName, handler) {
  return bus.subscribe(eventName, handler);
}

function listRecentDomainEvents(limit = 20) {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;
  return recentEvents.slice(-safeLimit).reverse();
}

module.exports = {
  publishDomainEvent,
  subscribeDomainEvent,
  listRecentDomainEvents,
};
