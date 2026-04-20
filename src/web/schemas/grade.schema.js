'use strict';

const gradeCreateSchema = {
  type: 'object',
  required: [
    'studentId',
    'subject',
    'value',
    'semester',
    'attendedLessons',
    'totalLessons',
  ],
  properties: {
    studentId: { type: 'integer', minimum: 1 },
    subject: { type: 'string', minLength: 1 },
    value: { type: 'number', minimum: 0, maximum: 100 },
    semester: { type: 'integer', enum: [1, 2] },
    attendedLessons: { type: 'integer', minimum: 0 },
    totalLessons: { type: 'integer', minimum: 1 },
  },
  additionalProperties: false,
};

const gradePatchSchema = {
  type: 'object',
  properties: {
    subject: { type: 'string', minLength: 1 },
    value: { type: 'number', minimum: 0, maximum: 100 },
    semester: { type: 'integer', enum: [1, 2] },
    attendedLessons: { type: 'integer', minimum: 0 },
    totalLessons: { type: 'integer', minimum: 1 },
  },
  additionalProperties: false,
};

const csvImportSchema = {
  type: 'object',
  required: ['dryRun'],
  properties: {
    dryRun: { type: 'boolean' },
  },
  additionalProperties: false,
};

module.exports = {
  csvImportSchema,
  gradeCreateSchema,
  gradePatchSchema,
};
