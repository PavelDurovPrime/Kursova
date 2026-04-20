'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const {
  getDataset: loadDatasetFromRepository,
  isSqliteMode,
} = require('../repository/repositoryFactory');

function resolveDataPath(explicitPath) {
  if (explicitPath) {
    return path.isAbsolute(explicitPath)
      ? explicitPath
      : path.join(process.cwd(), explicitPath);
  }
  return path.join(process.cwd(), 'data', 'grades.json');
}

let jsonCache = {
  mtimeMs: -1,
  data: null,
  error: null,
};

let sqliteDatasetRevision = 0;
let sqliteCache = {
  revision: 0,
  data: null,
  error: null,
};

function getDatasetVersion() {
  if (isSqliteMode()) {
    return `sqlite:${sqliteDatasetRevision}`;
  }
  if (jsonCache.data && jsonCache.mtimeMs >= 0) {
    return `json:${jsonCache.mtimeMs}`;
  }
  return 'json:unknown';
}

function bumpDatasetRevision() {
  sqliteDatasetRevision += 1;
  sqliteCache = { revision: sqliteDatasetRevision, data: null, error: null };
}

/**
 * Завантажує набір даних один раз або після зміни файлу на диску (mtime).
 * У режимі SQLite — кеш у пам'яті з інвалідацією через bumpDatasetRevision().
 */
async function getDataset(dataFilePath) {
  if (isSqliteMode()) {
    if (
      sqliteCache.data !== null &&
      sqliteCache.error === null &&
      sqliteCache.revision === sqliteDatasetRevision
    ) {
      return sqliteCache.data;
    }
    try {
      const data = await loadDatasetFromRepository(null);
      sqliteCache = {
        revision: sqliteDatasetRevision,
        data,
        error: null,
      };
      return data;
    } catch (e) {
      sqliteCache = {
        revision: sqliteDatasetRevision,
        data: null,
        error: e,
      };
      throw e;
    }
  }

  const fullPath = resolveDataPath(dataFilePath);

  let st;
  try {
    st = await fs.stat(fullPath);
  } catch {
    const missing = new Error('DATA_FILE_MISSING');
    missing.code = 'DATA_FILE_MISSING';
    jsonCache = { mtimeMs: -1, data: null, error: missing };
    throw missing;
  }

  if (jsonCache.data && jsonCache.mtimeMs === st.mtimeMs) {
    return jsonCache.data;
  }

  try {
    const data = await loadDatasetFromRepository(fullPath);
    jsonCache = { mtimeMs: st.mtimeMs, data, error: null };
    return data;
  } catch (e) {
    jsonCache = { mtimeMs: st.mtimeMs, data: null, error: e };
    throw e;
  }
}

function clearDatasetCache() {
  jsonCache = { mtimeMs: -1, data: null, error: null };
  sqliteCache = { revision: sqliteDatasetRevision, data: null, error: null };
}

module.exports = {
  getDataset,
  getDatasetVersion,
  bumpDatasetRevision,
  clearDatasetCache,
  resolveDataPath,
};
