'use strict';

const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

if (!process.env.DATABASE_URL) {
  const dbPath = path.join(process.cwd(), 'data', 'gradelogic.db');
  process.env.DATABASE_URL = `file:${dbPath}`;
}

const prisma = new PrismaClient();

module.exports = { prisma };
