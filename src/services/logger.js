const fs = require('node:fs/promises');
const path = require('node:path');

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

function formatTimestamp(date = new Date()) {
  return date.toISOString();
}

async function ensureLogDir() {
  await fs.mkdir(LOG_DIR, { recursive: true });
}

async function log(level, message) {
  const line = `[${formatTimestamp()}] [${String(level).toUpperCase()}] ${String(message)}\n`;
  await ensureLogDir();
  await fs.appendFile(LOG_FILE, line, 'utf8');
}

module.exports = {
  log
};

