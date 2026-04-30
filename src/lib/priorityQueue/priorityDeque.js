'use strict';

class PriorityDeque {
  constructor(options = {}) {
    this.compare = options.compare || ((a, b) => a.priority - b.priority);
    this.items = [];
    this.insertionOrder = 0;
  }

  enqueue(item, priority) {
    const entry = {
      item,
      priority: Number(priority),
      order: this.insertionOrder++,
      timestamp: Date.now(),
    };
    this.items.push(entry);
    this._sort();
  }

  dequeue(strategy = 'highest') {
    let result;
    if (this.isEmpty()) {
      result = undefined;
    } else {
      const strategies = {
        highest: () => this._dequeueHighest(),
        lowest: () => this._dequeueLowest(),
        oldest: () => this._dequeueOldest(),
        newest: () => this._dequeueNewest(),
      };
      const fn = strategies[strategy] || strategies.highest;
      result = fn();
    }
    return result;
  }

  peek(strategy = 'highest') {
    let result;
    if (this.isEmpty()) {
      result = undefined;
    } else {
      const strategies = {
        highest: () => this._peekHighest(),
        lowest: () => this._peekLowest(),
        oldest: () => this._peekOldest(),
        newest: () => this._peekNewest(),
      };
      const fn = strategies[strategy] || strategies.highest;
      result = fn();
    }
    return result;
  }

  _dequeueHighest() {
    return this.items.length === 0 ? undefined : this.items.shift().item;
  }

  _dequeueLowest() {
    return this.items.length === 0 ? undefined : this.items.pop().item;
  }

  _dequeueOldest() {
    let oldestIndex = 0;
    let oldestOrder = this.items[0].order;

    for (let i = 1; i < this.items.length; i++) {
      if (this.items[i].order < oldestOrder) {
        oldestOrder = this.items[i].order;
        oldestIndex = i;
      }
    }

    const [entry] = this.items.splice(oldestIndex, 1);
    return entry.item;
  }

  _dequeueNewest() {
    let newestIndex = 0;
    let newestOrder = this.items[0].order;

    for (let i = 1; i < this.items.length; i++) {
      if (this.items[i].order > newestOrder) {
        newestOrder = this.items[i].order;
        newestIndex = i;
      }
    }

    const [entry] = this.items.splice(newestIndex, 1);
    return entry.item;
  }

  _peekHighest() {
    return this.items[0]?.item;
  }

  _peekLowest() {
    return this.items[this.items.length - 1]?.item;
  }

  _peekOldest() {
    let oldest = this.items[0];
    for (const entry of this.items) {
      if (entry.order < oldest.order) {
        oldest = entry;
      }
    }
    return oldest.item;
  }

  _peekNewest() {
    let newest = this.items[0];
    for (const entry of this.items) {
      if (entry.order > newest.order) {
        newest = entry;
      }
    }
    return newest.item;
  }

  _sort() {
    this.items.sort((a, b) => {
      const priorityDiff = this.compare(a, b);
      if (priorityDiff !== 0) return priorityDiff;
      return a.order - b.order;
    });
  }

  isEmpty() {
    return this.items.length === 0;
  }

  size() {
    return this.items.length;
  }

  clear() {
    this.items = [];
    this.insertionOrder = 0;
  }

  toArray() {
    return this.items.map((e) => ({
      item: e.item,
      priority: e.priority,
      order: e.order,
    }));
  }

  getTopN(n, from = 'highest') {
    const sorted =
      from === 'highest' ? [...this.items] : [...this.items].reverse();
    return sorted.slice(0, n).map((e) => e.item);
  }

  getBottomN(n) {
    return this.getTopN(n, 'lowest');
  }
}

module.exports = { PriorityDeque };
