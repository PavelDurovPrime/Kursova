const fs = require('node:fs/promises');
const path = require('node:path');
const { loadData } = require('../repository/gradeRepository');

function resolveDataPath(explicitPath) {
  if (explicitPath) {
    return path.isAbsolute(explicitPath) ? explicitPath : path.join(process.cwd(), explicitPath);
  }
  return path.join(process.cwd(), 'data', 'grades.json');
}

let cache = {
  mtimeMs: -1,
  data: null,
  error: null
};

/**
 * Завантажує набір даних один раз або після зміни файлу на диску (mtime).
 * Зменшує навантаження при частих запитах на сервері.
 */
async function getDataset(dataFilePath) {
  const fullPath = resolveDataPath(dataFilePath);

  let st;
  try {
    st = await fs.stat(fullPath);
  } catch {
    const missing = new Error('DATA_FILE_MISSING');
    missing.code = 'DATA_FILE_MISSING';
    cache = { mtimeMs: -1, data: null, error: missing };
    throw missing;
  }

  if (cache.data && cache.mtimeMs === st.mtimeMs) {
    return cache.data;
  }

  try {
    const data = await loadData(fullPath);
    cache = { mtimeMs: st.mtimeMs, data, error: null };
    return data;
  } catch (e) {
    cache = { mtimeMs: st.mtimeMs, data: null, error: e };
    throw e;
  }
}

function clearDatasetCache() {
  cache = { mtimeMs: -1, data: null, error: null };
}

module.exports = {
  getDataset,
  clearDatasetCache,
  resolveDataPath
};
