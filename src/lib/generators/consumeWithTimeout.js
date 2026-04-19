'use strict';

async function consumeWithTimeout(iterator, seconds, onValue) {
  const callback = typeof onValue === 'function' ? onValue : () => {};
  const timeoutMs = Math.max(0, Number(seconds) * 1000);
  const start = Date.now();
  const deadline = start + timeoutMs;
  let iterations = 0;
  let lastValue = null;

  while (Date.now() < deadline) {
    const item = iterator.next();
    if (item.done) break;
    iterations += 1;
    lastValue = item.value;
    await callback(item.value, iterations);
  }

  return {
    iterations,
    lastValue,
    elapsedMs: Date.now() - start,
  };
}

module.exports = { consumeWithTimeout };
