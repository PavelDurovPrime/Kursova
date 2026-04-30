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

function createLogDecorator(level = 'INFO', options = {}) {
  const decoratorLevel = LogLevel[level.toUpperCase()] ?? LogLevel.INFO;
  const includeExecutionTime = options.includeExecutionTime ?? true;
  const includeArgs = options.includeArgs ?? true;
  const includeResult = options.includeResult ?? true;
  const condition = options.condition;

  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      const startTime = Date.now();
      const shouldLog = !condition || condition(args);

      if (shouldLog && decoratorLevel >= currentLogLevel) {
        await log(
          level,
          `→ ${propertyKey} called`,
          includeArgs
            ? {
                args: args.map((a) => (typeof a === 'object' ? '[Object]' : a)),
              }
            : {},
        );
      }

      try {
        const result = await originalMethod.apply(this, args);
        const executionTime = Date.now() - startTime;

        if (shouldLog && decoratorLevel >= currentLogLevel) {
          const metadata = {};
          if (includeExecutionTime) {
            metadata.executionTime = `${executionTime}ms`;
          }
          if (includeResult) {
            metadata.result = typeof result === 'object' ? '[Object]' : result;
          }
          await log(level, `← ${propertyKey} completed`, metadata);
        }

        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;

        if (shouldLog) {
          await log('ERROR', `✖ ${propertyKey} failed`, {
            error: error.message,
            executionTime: `${executionTime}ms`,
          });
        }

        throw error;
      }
    };

    return descriptor;
  };
}

function logDecorator(level = 'INFO', options = {}) {
  return createLogDecorator(level, options);
}

module.exports = {
  log,
  configure,
  createLogDecorator,
  logDecorator,
  LogLevel,
};
