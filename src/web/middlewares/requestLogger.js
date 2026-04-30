'use strict';

const { log } = require('../../services/logger');

function requestLogger(options = {}) {
  const logLevel = options.level || 'INFO';
  const skipPaths = options.skipPaths || ['/health', '/favicon.ico'];

  return async (req, res, next) => {
    const start = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.requestId = requestId;

    res.on('finish', async () => {
      const duration = Date.now() - start;
      const path = req.path || req.url;

      if (skipPaths.some((p) => path.includes(p))) {
        return;
      }

      const logData = {
        timestamp: new Date().toISOString(),
        requestId,
        method: req.method,
        path,
        query: req.query,
        statusCode: res.statusCode,
        duration,
        userAgent: req.get('user-agent'),
        ip: req.ip,
        userId: req.user?.sub,
        contentLength: res.get('content-length'),
      };

      const message = `${req.method} ${path} ${res.statusCode} ${duration}ms`;

      await log(logLevel, JSON.stringify({ ...logData, message }));
    });

    next();
  };
}

module.exports = { requestLogger };
