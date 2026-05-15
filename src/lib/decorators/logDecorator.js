const { log } = require('../../services/logger');

function logDecorator(level = 'INFO') {
  return function (originalFunction) {
    const fnName = originalFunction.name || 'anonymous';
    return async function (...args) {
      const startTime = Date.now();
      try {
        await log(level, `Calling ${fnName}`, { args });
        const result = await originalFunction.apply(this, args);
        const duration = Date.now() - startTime;
        await log(level, `Finished ${fnName}`, {
          result,
          durationMs: duration,
        });
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        await log('ERROR', `Error in ${fnName}`, {
          error: error.message,
          durationMs: duration,
        });
        throw error;
      }
    };
  };
}

module.exports = { logDecorator };
