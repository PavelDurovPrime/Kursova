'use strict';

const { fibonacciGenerator, weekDayGenerator } = require('./infinite');
const { consumeWithTimeout } = require('./consumeWithTimeout');

module.exports = {
  consumeWithTimeout,
  fibonacciGenerator,
  weekDayGenerator,
};
