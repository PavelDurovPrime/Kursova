'use strict';

const { loadData } = require('./gradeRepository');
const sqliteRepository = require('./sqlite/sqliteRepository');

const storageMode = String(process.env.DATA_STORAGE || 'json').toLowerCase();

function isSqliteMode() {
  return storageMode === 'sqlite';
}

async function getDataset(dataPath) {
  if (isSqliteMode()) {
    return sqliteRepository.getDatasetFromSqlite();
  }
  return loadData(dataPath);
}

module.exports = {
  getDataset,
  isSqliteMode,
  sqliteRepository,
};
