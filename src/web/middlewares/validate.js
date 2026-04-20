'use strict';

const Ajv = require('ajv');

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  removeAdditional: false,
});

function toErrorDetails(errors) {
  return (errors || []).map((error) => ({
    instancePath: error.instancePath,
    message: error.message,
    keyword: error.keyword,
  }));
}

function validate(schema, source = 'body') {
  const validateFn = ajv.compile(schema);
  return (req, res, next) => {
    const payload = req[source] || {};
    const isValid = validateFn(payload);
    if (isValid) return next();
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: toErrorDetails(validateFn.errors),
    });
  };
}

module.exports = { validate };
