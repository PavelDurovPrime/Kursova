'use strict';

const bcrypt = require('bcryptjs');
const { prisma } = require('../repository/sqlite/prismaClient');

async function ensureDefaultUsers() {
  const existing = await prisma.user.count();
  if (existing > 0) return;

  const users = [
    { email: 'admin@gradelogic.local', password: 'admin123', role: 'admin' },
    {
      email: 'teacher@gradelogic.local',
      password: 'teacher123',
      role: 'teacher',
    },
    {
      email: 'student@gradelogic.local',
      password: 'student123',
      role: 'student',
    },
  ];

  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await prisma.user.create({
      data: {
        email: user.email,
        passwordHash,
        role: user.role,
      },
    });
  }
}

async function validateCredentials(email, password) {
  const user = await prisma.user.findUnique({
    where: { email: String(email).trim().toLowerCase() },
  });
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
  };
}

module.exports = {
  ensureDefaultUsers,
  validateCredentials,
};
