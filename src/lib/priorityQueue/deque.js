'use strict';

class Deque {
  constructor() {
    this.items = [];
  }

  addFront(item) {
    this.items.unshift(item);
  }

  addRear(item) {
    this.items.push(item);
  }

  removeFront() {
    return this.isEmpty() ? undefined : this.items.shift();
  }

  removeRear() {
    return this.isEmpty() ? undefined : this.items.pop();
  }

  peekFront() {
    return this.isEmpty() ? undefined : this.items[0];
  }

  peekRear() {
    return this.isEmpty() ? undefined : this.items[this.items.length - 1];
  }

  isEmpty() {
    return this.items.length === 0;
  }

  size() {
    return this.items.length;
  }

  clear() {
    this.items = [];
  }

  toArray() {
    return [...this.items];
  }
}

module.exports = { Deque };
