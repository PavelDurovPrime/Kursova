'use strict';

const loginSchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', minLength: 3 },
    password: { type: 'string', minLength: 3 },
  },
  additionalProperties: false,
};

module.exports = { loginSchema };
