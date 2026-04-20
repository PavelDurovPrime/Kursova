'use strict';

const path = require('node:path');
const { loadData } = require('../src/repository/gradeRepository');
const { prisma } = require('../src/repository/sqlite/prismaClient');
const { ensureDefaultUsers } = require('../src/services/authService');

async function run() {
  const sourcePath = path.join(process.cwd(), 'data', 'grades.json');
  const { students, grades } = await loadData(sourcePath);

  await prisma.grade.deleteMany();
  await prisma.student.deleteMany();

  for (const student of students) {
    await prisma.student.create({
      data: {
        id: student.id,
        fullName: student.fullName,
        groupName: student.group,
      },
    });
  }

  for (const grade of grades) {
    await prisma.grade.create({
      data: {
        studentId: grade.studentId,
        subject: grade.subject,
        value: grade.value,
        semester: grade.semester || 1,
        attendedLessons: grade.attendedLessons || 0,
        totalLessons: grade.totalLessons || 1,
      },
    });
  }

  await ensureDefaultUsers();
  await prisma.academicPeriod.upsert({
    where: { code: '2025-all' },
    update: {},
    create: {
      code: '2025-all',
      label: '2025/26 навчальний рік',
      isActive: true,
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-06-30'),
    },
  });
  console.log(`Migrated students=${students.length} grades=${grades.length}`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
