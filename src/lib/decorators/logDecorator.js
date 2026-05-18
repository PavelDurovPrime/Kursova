'use strict';

const { log } = require('../../services/logger');

function logDecorator(level = 'INFO') {
  const upperLevel = String(level).toUpperCase();
  return function (originalFunction) {
    const fnName = originalFunction.name || 'anonymous';

    return function (...args) {
      const startTime = Date.now();

      if (upperLevel !== 'ERROR') {
        log(level, `Calling ${fnName}`, { args }).catch(() => {});
      }

      try {
        /* eslint-disable-next-line no-invalid-this */
        const result = originalFunction.apply(this, args);

        if (result instanceof Promise) {
          return result
            .then(async (resolvedResult) => {
              if (upperLevel !== 'ERROR') {
                const duration = Date.now() - startTime;
                await log(level, `Finished ${fnName}`, {
                  result: resolvedResult,
                  durationMs: duration,
                });
              }
              return resolvedResult;
            })
            .catch(async (error) => {
              const duration = Date.now() - startTime;
              await log('ERROR', `Error in ${fnName}`, {
                error: error.message,
                durationMs: duration,
              });
              throw error;
            });
        }

        if (upperLevel !== 'ERROR') {
          const duration = Date.now() - startTime;
          log(level, `Finished ${fnName}`, {
            result,
            durationMs: duration,
          }).catch(() => {});
        }
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        log('ERROR', `Error in ${fnName}`, {
          error: error.message,
          durationMs: duration,
        }).catch(() => {});
        throw error;
      }
    };
  };
}

module.exports = { logDecorator };
