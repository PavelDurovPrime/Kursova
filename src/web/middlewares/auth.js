'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'gradelogic-dev-secret';

function issueToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '2h' },
  );
}

function authenticate(req, res, next) {
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
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
      details: null,
    });
  }
}

function requireRole(roles) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
        details: { required: allowedRoles },
      });
    }
    return next();
  };
}

module.exports = {
  authenticate,
  issueToken,
  requireRole,
};
