'use strict';

const { asyncMap } = require('../src/lib/async-array');

async function main() {
  const result = await asyncMap([1, 2, 3], async (item) => item * 10);
  console.log(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
