'use strict';

const { prisma } = require('./prismaClient');

async function getDatasetFromSqlite() {
  const students = await prisma.student.findMany({
    orderBy: [{ groupName: 'asc' }, { fullName: 'asc' }],
  });
  const grades = await prisma.grade.findMany();

  return {
    students: students.map((student) => ({
      id: student.id,
      fullName: student.fullName,
      group: student.groupName,
    })),
    grades: grades.map((grade) => ({
      id: grade.id,
      studentId: grade.studentId,
      subject: grade.subject,
      value: grade.value,
      semester: grade.semester,
      attendedLessons: grade.attendedLessons,
      totalLessons: grade.totalLessons,
    })),
  };
}

async function createGrade(input) {
  return prisma.grade.create({
    data: {
      studentId: input.studentId,
      subject: input.subject,
      value: input.value,
      semester: input.semester,
      attendedLessons: input.attendedLessons,
      totalLessons: input.totalLessons,
    },
  });
}

async function updateGrade(gradeId, patch) {
  return prisma.grade.update({
    where: { id: gradeId },
    data: patch,
  });
}

async function deleteGrade(gradeId) {
  await prisma.grade.delete({
    where: { id: gradeId },
  });
}

async function createManyGrades(items) {
  const created = [];
  for (const item of items) {
    const grade = await createGrade(item);
    created.push(grade);
  }
  return created;
}

async function listAuditLogs({ page, limit, action, entity }) {
  const where = {};
  if (action) where.action = action;
  if (entity) where.entity = entity;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, total };
}

async function writeAuditLog(entry) {
  return prisma.auditLog.create({
    data: {
      actorId: entry.actorId || null,
      action: entry.action,
      entity: entry.entity,
      entityId: String(entry.entityId),
      payload: JSON.stringify(entry.payload || {}),
    },
  });
}

module.exports = {
  createGrade,
  createManyGrades,
  deleteGrade,
  getDatasetFromSqlite,
  listAuditLogs,
  updateGrade,
  writeAuditLog,
};
