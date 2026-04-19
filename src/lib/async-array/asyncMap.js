'use strict';

function createAbortError() {
  const error = new Error('Operation aborted');
  error.name = 'AbortError';
  return error;
}

function asyncMap(items, mapper, options = {}) {
  const signal = options.signal;
  const promises = items.map(async (item, index) => {
    if (signal && signal.aborted) throw createAbortError();
    return mapper(item, index, items);
  });
  return Promise.all(promises);
}

module.exports = {
  asyncMap,
  createAbortError,
};
