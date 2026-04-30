'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'gradelogic-dev-secret';
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000;

class AuthProxy {
  constructor(options = {}) {
    this.refreshThreshold = options.refreshThreshold || TOKEN_REFRESH_THRESHOLD;
    this.onTokenRefresh = options.onTokenRefresh || null;
    this.tokenCache = new Map();
  }

  middleware() {
    return (req, res, next) => {
      const authHeader = req.headers.authorization || '';
      const [, token] = authHeader.split(' ');

      if (!token) {
        return res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Missing bearer token',
          details: null,
        });
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;

        const shouldRefresh = this._shouldRefreshToken(decoded);
        if (shouldRefresh) {
          const newToken = this._refreshToken(decoded);
          res.setHeader('X-Token-Refresh', newToken);
          this.tokenCache.set(decoded.sub, newToken);

          if (this.onTokenRefresh) {
            this.onTokenRefresh(decoded.sub, newToken);
          }
        }

        return next();
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({
            code: 'TOKEN_EXPIRED',
            message: 'Token has expired',
            details: null,
          });
        }
        return res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Invalid token',
          details: null,
        });
      }
    };
  }

  _shouldRefreshToken(decoded) {
    if (!decoded.exp) return false;
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = (decoded.exp - now) * 1000;
    return timeUntilExpiry < this.refreshThreshold;
  }

  _refreshToken(decoded) {
    return jwt.sign(
      {
        sub: decoded.sub,
        email: decoded.email,
        role: decoded.role,
      },
      JWT_SECRET,
      { expiresIn: '2h' },
    );
  }

  injectAuthHeader(token) {
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  }

  createProxyRequest(originalReq, token) {
    return {
      ...originalReq,
      headers: {
        ...originalReq.headers,
        Authorization: `Bearer ${token}`,
      },
    };
  }
}

class RateLimiter {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || 100;
    this.windowMs = options.windowMs || 60 * 1000;
    this.clients = new Map();
  }

  middleware() {
    return (req, res, next) => {
      const clientId = req.user?.sub || req.ip || 'anonymous';
      const now = Date.now();

      if (!this.clients.has(clientId)) {
        this.clients.set(clientId, []);
      }

      const requests = this.clients.get(clientId);
      const windowStart = now - this.windowMs;

      while (requests.length > 0 && requests[0] < windowStart) {
        requests.shift();
      }

      if (requests.length >= this.maxRequests) {
        const retryAfter = Math.ceil(
          (requests[0] + this.windowMs - now) / 1000,
        );
        res.setHeader('Retry-After', retryAfter);
        return res.status(429).json({
          code: 'RATE_LIMITED',
          message: 'Too many requests',
          details: { retryAfter },
        });
      }

      requests.push(now);
      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader(
        'X-RateLimit-Remaining',
        Math.max(0, this.maxRequests - requests.length),
      );

      return next();
    };
  }

  getStats(clientId) {
    const requests = this.clients.get(clientId) || [];
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const recentRequests = requests.filter((t) => t > windowStart);
    return {
      total: recentRequests.length,
      remaining: Math.max(0, this.maxRequests - recentRequests.length),
      resetTime:
        recentRequests.length > 0 ? recentRequests[0] + this.windowMs : now,
    };
  }
}

function createAuthProxy(options = {}) {
  const proxy = new AuthProxy(options);
  return proxy.middleware();
}

function createRateLimiter(options = {}) {
  const limiter = new RateLimiter(options);
  return limiter.middleware();
}

module.exports = {
  AuthProxy,
  RateLimiter,
  createAuthProxy,
  createRateLimiter,
};
