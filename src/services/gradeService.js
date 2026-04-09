/**
 * Період: увесь навчальний рік або окремий семестр.
 * @param {'all'|'1'|'2'} period
 */
function normalizePeriod(period) {
  const s = String(period ?? 'all').trim().toLowerCase();
  if (s === '1' || s === 'sem1' || s === 'semester1' || s === 'i') return '1';
  if (s === '2' || s === 'sem2' || s === 'semester2' || s === 'ii') return '2';
  return 'all';
}

function filterGradesByPeriod(grades, period) {
  const p = normalizePeriod(period);
  if (p === 'all') return grades;
  const sem = p === '1' ? 1 : 2;
  return grades.filter((g) => g.semester === sem);
}

function valueToECTS(value) {
  if (!Number.isFinite(value)) return null;
  if (value >= 90) return 'A';
  if (value >= 82) return 'B';
  if (value >= 74) return 'C';
  if (value >= 64) return 'D';
  if (value >= 60) return 'E';
  return 'F';
}

function mean(nums) {
  const arr = nums.filter((x) => Number.isFinite(x));
  if (arr.length === 0) return NaN;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function attendanceAggregate(gradeList) {
  if (!gradeList.length) {
    return { attended: 0, total: 0, percent: NaN };
  }
  const attended = gradeList.reduce((s, g) => s + g.attendedLessons, 0);
  const total = gradeList.reduce((s, g) => s + g.totalLessons, 0);
  const percent = total > 0 ? (attended / total) * 100 : NaN;
  return { attended, total, percent };
}

function buildReportRowBase(student, gradeCount, average, att) {
  return {
    id: student.id,
    fullName: student.fullName,
    group: student.group,
    gradeCount,
    average,
    ects: valueToECTS(average),
    attendancePercent: att.percent,
    attendedLessons: att.attended,
    totalLessons: att.total
  };
}

function buildStudentReport(students, grades) {
  return students.map((s) => {
    const sGrades = grades.filter((g) => g.studentId === s.id);
    const count = sGrades.length;
    const avg = mean(sGrades.map((g) => g.value));
    const att = attendanceAggregate(sGrades);
    return buildReportRowBase(s, count, avg, att);
  });
}

const strategies = {
  'by-name': (a, b) => a.fullName.localeCompare(b.fullName, 'uk'),
  'by-average-desc': (a, b) => {
    const aVal = Number.isFinite(a.average) ? a.average : -Infinity;
    const bVal = Number.isFinite(b.average) ? b.average : -Infinity;
    return bVal - aVal;
  },
  'by-subject-average-desc': (a, b) => {
    const aVal = Number.isFinite(a.average) ? a.average : -Infinity;
    const bVal = Number.isFinite(b.average) ? b.average : -Infinity;
    return bVal - aVal;
  },
  'by-count-desc': (a, b) => b.gradeCount - a.gradeCount,
  'by-attendance-desc': (a, b) => {
    const aVal = Number.isFinite(a.attendancePercent) ? a.attendancePercent : -Infinity;
    const bVal = Number.isFinite(b.attendancePercent) ? b.attendancePercent : -Infinity;
    return bVal - aVal;
  }
};

function sortStudents(students, strategyName) {
  const cmp = strategies[strategyName] || strategies['by-name'];
  return [...students].sort(cmp);
}

function findStudentsByName(students, query) {
  const lower = query.toLowerCase();
  return students.filter((s) => s.fullName.toLowerCase().includes(lower));
}

function buildStudentAverage(students, grades) {
  return buildStudentReport(students, grades);
}

function buildStudentSubjectAverage(students, grades, subjectName) {
  const normalizedSubject = String(subjectName || '').trim().toLowerCase();
  if (!normalizedSubject) {
    return students.map((s) => {
      const empty = { attended: 0, total: 0, percent: NaN };
      return buildReportRowBase(s, 0, NaN, empty);
    });
  }

  return students.map((s) => {
    const list = grades.filter(
      (g) => g.studentId === s.id && String(g.subject || '').trim().toLowerCase() === normalizedSubject
    );
    const count = list.length;
    const avg = mean(list.map((g) => g.value));
    const att = attendanceAggregate(list);
    return buildReportRowBase(s, count, avg, att);
  });
}

module.exports = {
  normalizePeriod,
  filterGradesByPeriod,
  valueToECTS,
  buildStudentReport,
  buildStudentAverage,
  buildStudentSubjectAverage,
  sortStudents,
  findStudentsByName,
  attendanceAggregate,
  strategies
};
