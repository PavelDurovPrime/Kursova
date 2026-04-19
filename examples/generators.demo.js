'use strict';

const {
  fibonacciGenerator,
  weekDayGenerator,
  consumeWithTimeout,
} = require('../src/lib/generators');

async function main() {
  const fib = fibonacciGenerator();
  const fibSummary = await consumeWithTimeout(fib, 0.02);
  console.log('Fibonacci summary:', fibSummary);

  const days = weekDayGenerator();
  const daySummary = await consumeWithTimeout(days, 0.02);
  console.log('Days summary:', daySummary);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
