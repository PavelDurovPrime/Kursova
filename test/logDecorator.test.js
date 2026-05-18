'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { logDecorator } = require('../src/lib/decorators/logDecorator');
const { configure } = require('../src/services/logger');

const LOG_FILE = path.join(process.cwd(), 'logs', 'app.log');

async function cleanLogFile() {
  try {
    await fs.rm(LOG_FILE, { force: true });
  } catch {
    // Ignore if file doesn't exist
  }
}

async function readLogLines() {
  try {
    const content = await fs.readFile(LOG_FILE, 'utf8');
    return content.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

test('logDecorator: sync function logging (INFO level)', async () => {
  await cleanLogFile();
  configure({ level: 'INFO', jsonFormat: false });

  const add = (a, b) => a + b;
  const decoratedAdd = logDecorator('INFO')(add);

  const result = decoratedAdd(2, 3);
  assert.equal(result, 5);

  // Give a small amount of time for async file write to finish
  await new Promise((resolve) => setTimeout(resolve, 50));

  const lines = await readLogLines();
  assert.equal(lines.length, 2);
  assert.match(lines[0], /\[INFO\] Calling add/);
  assert.match(lines[0], /"args":\[2,3\]/);
  assert.match(lines[1], /\[INFO\] Finished add/);
  assert.match(lines[1], /"result":5/);
  assert.match(lines[1], /"durationMs":/);
});

test('logDecorator: async function logging (INFO level)', async () => {
  await cleanLogFile();
  configure({ level: 'INFO', jsonFormat: false });

  const delayAdd = async (a, b) => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return a + b;
  };
  const decoratedDelayAdd = logDecorator('INFO')(delayAdd);

  const result = await decoratedDelayAdd(10, 20);
  assert.equal(result, 30);

  // Give a small amount of time for async file write to finish
  await new Promise((resolve) => setTimeout(resolve, 50));

  const lines = await readLogLines();
  assert.equal(lines.length, 2);
  assert.match(lines[0], /\[INFO\] Calling delayAdd/);
  assert.match(lines[0], /"args":\[10,20\]/);
  assert.match(lines[1], /\[INFO\] Finished delayAdd/);
  assert.match(lines[1], /"result":30/);
  assert.match(lines[1], /"durationMs":/);
});

test('logDecorator: conditional logging (ERROR level) - success case does not log', async () => {
  await cleanLogFile();
  configure({ level: 'INFO', jsonFormat: false });

  const multiply = (a, b) => a * b;
  const decoratedMultiply = logDecorator('ERROR')(multiply);

  const result = decoratedMultiply(3, 4);
  assert.equal(result, 12);

  await new Promise((resolve) => setTimeout(resolve, 50));

  const lines = await readLogLines();
  assert.equal(
    lines.length,
    0,
    'Should not log anything on success when level is ERROR',
  );
});

test('logDecorator: conditional logging (ERROR level) - logs exception', async () => {
  await cleanLogFile();
  configure({ level: 'INFO', jsonFormat: false });

  const failFunc = () => {
    throw new Error('Test failure');
  };
  const decoratedFailFunc = logDecorator('ERROR')(failFunc);

  assert.throws(() => decoratedFailFunc(), /Test failure/);

  await new Promise((resolve) => setTimeout(resolve, 50));

  const lines = await readLogLines();
  assert.equal(lines.length, 1);
  assert.match(lines[0], /\[ERROR\] Error in failFunc/);
  assert.match(lines[0], /"error":"Test failure"/);
  assert.match(lines[0], /"durationMs":/);
});

test('logDecorator: async function conditional logging (ERROR level) - logs exception', async () => {
  await cleanLogFile();
  configure({ level: 'INFO', jsonFormat: false });

  const failAsyncFunc = async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    throw new Error('Async test failure');
  };
  const decoratedFailAsyncFunc = logDecorator('ERROR')(failAsyncFunc);

  await assert.rejects(
    async () => await decoratedFailAsyncFunc(),
    /Async test failure/,
  );

  await new Promise((resolve) => setTimeout(resolve, 50));

  const lines = await readLogLines();
  assert.equal(lines.length, 1);
  assert.match(lines[0], /\[ERROR\] Error in failAsyncFunc/);
  assert.match(lines[0], /"error":"Async test failure"/);
  assert.match(lines[0], /"durationMs":/);
});
