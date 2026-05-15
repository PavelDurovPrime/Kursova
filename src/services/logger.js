const fs = require('node:fs/promises');
const path = require('node:path');
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};
let currentLogLevel = LogLevel.INFO;
let useJsonFormat = false;
let customFormatter = null;
function formatTimestamp(date = new Date()) {
  return date.toISOString();
}
async function ensureLogDir() {
  await fs.mkdir(LOG_DIR, { recursive: true });
}
function formatLogLine(level, message, metadata = {}) {
  if (useJsonFormat || customFormatter) {
    const logEntry = {
      timestamp: formatTimestamp(),
      level: String(level).toUpperCase(),
      message: String(message),
      ...metadata,
    };
    if (customFormatter) {
      return customFormatter(logEntry);
    }
    return `${JSON.stringify(logEntry)}\n`;
  }
  const metaStr =
    Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : '';
  return `[${formatTimestamp()}] [${String(level).toUpperCase()}] ${String(message)}${metaStr}\n`;
}
async function log(level, message, metadata = {}) {
  const levelValue =
    typeof level === 'string' ? LogLevel[level.toUpperCase()] : level;
  if (levelValue === undefined || levelValue < currentLogLevel) {
    return;
  }
  const line = formatLogLine(level, message, metadata);
  await ensureLogDir();
  await fs.appendFile(LOG_FILE, line, 'utf8');
  if (levelValue >= LogLevel.WARN) {
    console.error(line.trim());
  }
}
function configure(options = {}) {
  if (options.level !== undefined) {
    currentLogLevel = LogLevel[options.level.toUpperCase()] ?? LogLevel.INFO;
  }
  if (options.jsonFormat !== undefined) {
    useJsonFormat = options.jsonFormat;
  }
  if (options.formatter !== undefined) {
    customFormatter = options.formatter;
  }
}
module.exports = {
  log,
  configure,
  LogLevel,
};
