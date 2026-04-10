const {
  buildStudentReport,
  buildStudentSubjectAverage,
  sortStudents,
  findStudentsByName,
  filterGradesByPeriod,
  normalizePeriod
} = require('../services/gradeService');
const { buildReportStats, applyGroupFilter, buildReportView, periodCaption } = require('../reportView');

const ALLOWED_SORT = new Set([
  'by-name',
  'by-average-desc',
  'by-count-desc',
  'by-subject-average-desc',
  'by-attendance-desc'
]);

function normalizeSort(value) {
  const s = String(value || 'by-name').trim();
  return ALLOWED_SORT.has(s) ? s : 'by-name';
}

class SubjectRequiredError extends Error {
  constructor() {
    super('Потрібна назва предмета');
    this.name = 'SubjectRequiredError';
    this.code = 'SUBJECT_REQUIRED';
  }
}

function computeWebReport(students, grades, { group, sort, subject, top, query, period }) {
  const periodNorm = normalizePeriod(period);
  const sortStrategy = normalizeSort(sort);
  const periodFiltered = filterGradesByPeriod(grades, periodNorm);
  const groupTrim = group ? String(group).trim() : '';
  const { scopedStudents, scopedGrades, scopeLabel, scopeAverageCaption } = applyGroupFilter(
    students,
    periodFiltered,
    groupTrim || null
  );

  const q = query ? String(query).trim() : '';
  let rows;
  let title;

  const periodHuman = periodCaption(periodNorm);

  if (q) {
    const matches = findStudentsByName(buildStudentReport(scopedStudents, scopedGrades), q);
    if (sortStrategy === 'by-subject-average-desc') {
      const subj = String(subject || '').trim();
      if (!subj) throw new SubjectRequiredError();
      rows = sortStudents(buildStudentSubjectAverage(matches, scopedGrades, subj), sortStrategy);
    } else {
      rows = sortStudents(matches, sortStrategy);
    }
    title = `Результати пошуку за «${q}» — ${scopeLabel} · ${periodHuman}`;
  } else if (sortStrategy === 'by-subject-average-desc') {
    const subj = String(subject || '').trim();
    if (!subj) throw new SubjectRequiredError();
    const view = buildReportView({
      students: scopedStudents,
      grades: scopedGrades,
      sortStrategy,
      subject: subj,
      scopeLabel,
      period: periodNorm
    });
    rows = view.rows;
    title = view.title;
  } else {
    const view = buildReportView({
      students: scopedStudents,
      grades: scopedGrades,
      sortStrategy,
      scopeLabel,
      period: periodNorm
    });
    rows = view.rows;
    title = view.title;
  }

  const topN = top !== undefined && top !== '' ? Number.parseInt(String(top), 10) : null;
  const limited = Number.isFinite(topN) && topN > 0 ? rows.slice(0, topN) : rows;
  const stats = buildReportStats(limited);

  return {
    title,
    rows: limited,
    stats,
    scopeAverageCaption,
    totalCount: rows.length,
    shownCount: limited.length,
    period: periodNorm
  };
}

function uniqueSubjects(grades) {
  return [...new Set((grades || []).map((g) => g.subject).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'uk')
  );
}

function uniqueGroups(students) {
  return [...new Set((students || []).map((s) => s.group).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'uk')
  );
}

module.exports = {
  computeWebReport,
  normalizeSort,
  normalizePeriod,
  uniqueSubjects,
  uniqueGroups,
  SubjectRequiredError
};
