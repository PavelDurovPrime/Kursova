'use strict';

const reportQuerySchema = {
  type: 'object',
  properties: {
    group: { type: 'string' },
    sort: { type: 'string' },
    subject: { type: 'string' },
    top: { type: 'string' },
    query: { type: 'string' },
    period: { type: 'string' },
    page: { type: 'string' },
    limit: { type: 'string' },
  },
  additionalProperties: true,
};

module.exports = {
  reportQuerySchema,
};
