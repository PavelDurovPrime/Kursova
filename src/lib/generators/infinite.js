'use strict';

const WEEK_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function* fibonacciGenerator(first = 0, second = 1) {
  let prev = Number(first);
  let curr = Number(second);
  while (true) {
    yield prev;
    const next = prev + curr;
    prev = curr;
    curr = next;
  }
}

function* weekDayGenerator() {
  let index = 0;
  while (true) {
    yield WEEK_DAYS[index];
    index = (index + 1) % WEEK_DAYS.length;
  }
}

module.exports = {
  fibonacciGenerator,
  weekDayGenerator,
};
