'use strict';

const { parse } = require('csv-parse/sync');

function parseGradesCsv(csvText) {
  const records = parse(csvText, {
    columns: true,
    skipEmptyLines: true,
    trim: true,
  });

  return records.map((record) => ({
    studentId: Number.parseInt(record.studentId, 10),
    subject: record.subject,
    value: Number(record.value),
    semester: Number.parseInt(record.semester, 10),
    attendedLessons: Number.parseInt(record.attendedLessons, 10),
    totalLessons: Number.parseInt(record.totalLessons, 10),
  }));
}

module.exports = {
  parseGradesCsv,
};
