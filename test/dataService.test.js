'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const dataServicePath = require.resolve('../src/web/dataService');
const repositoryFactoryPath =
  require.resolve('../src/repository/repositoryFactory');

function reloadDataService(storage) {
  if (storage === 'sqlite') {
    process.env.DATA_STORAGE = 'sqlite';
  } else {
    delete process.env.DATA_STORAGE;
  }
  delete require.cache[dataServicePath];
  delete require.cache[repositoryFactoryPath];
  return require('../src/web/dataService');
}

test.afterEach(() => {
  delete process.env.DATA_STORAGE;
  delete require.cache[dataServicePath];
  delete require.cache[repositoryFactoryPath];
});

test('resolveDataPath: default points to data/grades.json', () => {
  const ds = reloadDataService('json');
  const p = ds.resolveDataPath(null);
  assert.ok(p.endsWith(path.join('data', 'grades.json')));
});

test('resolveDataPath: relative path under cwd', () => {
  const ds = reloadDataService('json');
  const p = ds.resolveDataPath('custom/x.json');
  assert.ok(p.includes('custom'));
  assert.ok(p.endsWith('x.json'));
});

test('JSON mode: getDataset loads sample and caches by mtime', async () => {
  const ds = reloadDataService('json');
  const gradesPath = path.join(__dirname, '..', 'data', 'grades.json');
  ds.clearDatasetCache();
  const first = await ds.getDataset(gradesPath);
  assert.ok(Array.isArray(first.students));
  assert.ok(first.students.length > 0);
  const second = await ds.getDataset(gradesPath);
  assert.strictEqual(first, second);
  assert.match(ds.getDatasetVersion(), /^json:\d/);
});

test('JSON mode: getDatasetVersion before load', () => {
  const ds = reloadDataService('json');
  ds.clearDatasetCache();
  assert.strictEqual(ds.getDatasetVersion(), 'json:unknown');
});

test('SQLite mode: getDatasetVersion tracks bumpDatasetRevision', () => {
  const ds = reloadDataService('sqlite');
  assert.strictEqual(ds.getDatasetVersion(), 'sqlite:0');
  ds.bumpDatasetRevision();
  assert.strictEqual(ds.getDatasetVersion(), 'sqlite:1');
  ds.bumpDatasetRevision();
  assert.strictEqual(ds.getDatasetVersion(), 'sqlite:2');
});
