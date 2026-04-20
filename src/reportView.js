const {
  buildStudentReport,
  buildStudentSubjectAverage,
  sortStudents,
} = require('./services/gradeService');

function buildReportStats(rows) {
  const finiteAverages = rows.filter((r) => Number.isFinite(r.average));
  const bestStudent =
    finiteAverages.length > 0
      ? finiteAverages.reduce(
          (best, cur) => (cur.average > best.average ? cur : best),
          finiteAverages[0],
        )
      : null;

  const groupAverage =
    finiteAverages.length > 0
      ? finiteAverages.reduce((acc, r) => acc + r.average, 0) /
        finiteAverages.length
      : NaN;

  return {
    bestStudent,
    groupAverage,
  };
}

function applyGroupFilter(students, grades, groupName) {
  if (!groupName) {
    return {
      scopedStudents: students,
      scopedGrades: grades,
      scopeLabel: 'весь потік',
      scopeAverageCaption: 'Загальний середній бал по потоку',
    };
  }

  const scopedStudents = students.filter((s) => s.group === groupName);
  const idSet = new Set(scopedStudents.map((s) => s.id));
  const scopedGrades = grades.filter((g) => idSet.has(g.studentId));

  return {
    scopedStudents,
    scopedGrades,
    scopeLabel: `група "${groupName}"`,
    scopeAverageCaption: `Загальний середній бал по групі "${groupName}"`,
  };
}

function periodCaption(period) {
  const p = period === '1' || period === '2' ? period : 'all';
  if (p === '1') return '1 семестр';
  if (p === '2') return '2 семестр';
  return 'навчальний рік (обидва семестри)';
}

const SORT_LABELS = {
  'by-name': 'за ПІБ (А–Я)',
  'by-average-desc': 'за середнім балом (від більшого)',
  'by-count-desc': 'за кількістю оцінок',
  'by-subject-average-desc': 'за балом з предмета',
  'by-attendance-desc': 'за відвідуваністю (%)',
};

function buildReportView({
  students,
  grades,
  sortStrategy,
  subject,
  scopeLabel,
  period,
}) {
  const baseRows =
    sortStrategy === 'by-subject-average-desc'
      ? buildStudentSubjectAverage(students, grades, subject)
      : buildStudentReport(students, grades);

  const sortedRows = sortStudents(baseRows, sortStrategy);
  const stats = buildReportStats(sortedRows);

  const sortHuman = SORT_LABELS[sortStrategy] || sortStrategy;
  let title =
    sortStrategy === 'by-subject-average-desc'
      ? `Звіт по студентах: предмет «${subject}», сортування ${sortHuman}`
      : `Звіт по студентах, сортування ${sortHuman}`;

  const pCap = periodCaption(period);
  title = `${title} · ${pCap}`;
  const scopedTitle = scopeLabel ? `${title} — ${scopeLabel}` : title;

  return { title: scopedTitle, rows: sortedRows, stats };
}

module.exports = {
  buildReportStats,
  applyGroupFilter,
  buildReportView,
  periodCaption,
  SORT_LABELS,
};
