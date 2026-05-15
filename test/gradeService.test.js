'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizePeriod,
  filterGradesByPeriod,
  valueToECTS,
  buildStudentReport,
  buildStudentAverage,
  buildStudentSubjectAverage,
  sortStudents,
  findStudentsByName,
  attendanceAggregate,
  strategies,
} = require('../src/services/gradeService');
const GROUP_NAMES = ['ІП-11', 'ІП-12', 'ІП-13', 'ІП-14', 'ІП-15'];
const FIRST_NAMES = [
  'Іван',
  'Олена',
  'Максим',
  'Анна',
  'Петро',
  'Марія',
  'Олег',
  'Тетяна',
  'Сергій',
  'Наталія',
];
const LAST_NAMES = [
  'Коваленко',
  'Петренко',
  'Мельник',
  'Бондаренко',
  'Кравченко',
  'Сидоренко',
  'Ткаченко',
  'Шевченко',
  'Кузьменко',
  'Гончар',
  'Романенко',
  'Литвин',
  'Мороз',
  'Кириченко',
  'Даниленко',
  'Яременко',
  'Пономаренко',
  'Семенюк',
  'Микитенко',
  'Крамар',
  'Гаврилюк',
  'Хоменко',
  'Нестеренко',
  'Левченко',
  'Кожухар',
  'Турчин',
  'Павленко',
  'Кузнецов',
  'Білик',
  'Савчук',
];
const SUBJECTS = ['Математика', 'Фізика', 'Програмування'];
function buildFixtures() {
  const students = [];
  const grades = [];
  for (let i = 0; i < 150; i++) {
    const id = i + 1;
    const groupIndex = Math.floor(i / 30);
    const posInGroup = i % 30;
    const fullName = `${LAST_NAMES[posInGroup]} ${FIRST_NAMES[posInGroup % FIRST_NAMES.length]}`;
    students.push({ id, fullName, group: GROUP_NAMES[groupIndex] });
    for (const subject of SUBJECTS) {
      for (const semester of [1, 2]) {
        const value = Math.min(
          100,
          50 + ((id * 7 + semester * 5 + subject.length * 3) % 51),
        );
        const totalLessons = 20 + ((id + semester) % 10);
        const attendedLessons = Math.min(
          totalLessons,
          Math.round(totalLessons * (0.6 + (id % 30) / 100)),
        );
        grades.push({
          studentId: id,
          subject,
          value,
          semester,
          attendedLessons,
          totalLessons,
        });
      }
    }
  }
  return { students, grades };
}
const { students, grades } = buildFixtures();
test('normalizePeriod: повертає "all" для undefined', () => {
  assert.equal(normalizePeriod(undefined), 'all');
});
test('normalizePeriod: повертає "all" для null', () => {
  assert.equal(normalizePeriod(null), 'all');
});
test('normalizePeriod: повертає "all" для порожнього рядка', () => {
  assert.equal(normalizePeriod(''), 'all');
});
test('normalizePeriod: розпізнає "1"', () => {
  assert.equal(normalizePeriod('1'), '1');
});
test('normalizePeriod: розпізнає псевдонім "sem1"', () => {
  assert.equal(normalizePeriod('sem1'), '1');
});
test('normalizePeriod: розпізнає псевдонім "semester1"', () => {
  assert.equal(normalizePeriod('semester1'), '1');
});
test('normalizePeriod: розпізнає римську цифру "I"', () => {
  assert.equal(normalizePeriod('I'), '1');
});
test('normalizePeriod: розпізнає "2"', () => {
  assert.equal(normalizePeriod('2'), '2');
});
test('normalizePeriod: розпізнає псевдонім "sem2"', () => {
  assert.equal(normalizePeriod('sem2'), '2');
});
test('normalizePeriod: розпізнає псевдонім "semester2"', () => {
  assert.equal(normalizePeriod('semester2'), '2');
});
test('normalizePeriod: розпізнає римську цифру "II"', () => {
  assert.equal(normalizePeriod('II'), '2');
});
test('normalizePeriod: невідоме значення повертає "all"', () => {
  assert.equal(normalizePeriod('xyz'), 'all');
});
test('filterGradesByPeriod: "all" повертає всі оцінки', () => {
  const filtered = filterGradesByPeriod(grades, 'all');
  assert.equal(filtered.length, grades.length);
});
test('filterGradesByPeriod: "1" залишає лише оцінки 1-го семестру', () => {
  const filtered = filterGradesByPeriod(grades, '1');
  assert.ok(filtered.every((g) => g.semester === 1));
  assert.ok(filtered.length > 0);
});
test('filterGradesByPeriod: "2" залишає лише оцінки 2-го семестру', () => {
  const filtered = filterGradesByPeriod(grades, '2');
  assert.ok(filtered.every((g) => g.semester === 2));
  assert.ok(filtered.length > 0);
});
test('filterGradesByPeriod: сума сем1 + сем2 дорівнює загальній кількості', () => {
  const s1 = filterGradesByPeriod(grades, '1');
  const s2 = filterGradesByPeriod(grades, '2');
  assert.equal(s1.length + s2.length, grades.length);
});
test('filterGradesByPeriod: псевдонім "sem1" дає той самий результат', () => {
  const bySem1 = filterGradesByPeriod(grades, 'sem1');
  const by1 = filterGradesByPeriod(grades, '1');
  assert.equal(bySem1.length, by1.length);
});
test('valueToECTS: 100 → A', () => {
  assert.equal(valueToECTS(100), 'A');
});
test('valueToECTS: 90 → A (нижня межа A)', () => {
  assert.equal(valueToECTS(90), 'A');
});
test('valueToECTS: 89 → B', () => {
  assert.equal(valueToECTS(89), 'B');
});
test('valueToECTS: 82 → B (нижня межа B)', () => {
  assert.equal(valueToECTS(82), 'B');
});
test('valueToECTS: 81 → C', () => {
  assert.equal(valueToECTS(81), 'C');
});
test('valueToECTS: 74 → C (нижня межа C)', () => {
  assert.equal(valueToECTS(74), 'C');
});
test('valueToECTS: 73 → D', () => {
  assert.equal(valueToECTS(73), 'D');
});
test('valueToECTS: 64 → D (нижня межа D)', () => {
  assert.equal(valueToECTS(64), 'D');
});
test('valueToECTS: 63 → E', () => {
  assert.equal(valueToECTS(63), 'E');
});
test('valueToECTS: 60 → E (нижня межа E)', () => {
  assert.equal(valueToECTS(60), 'E');
});
test('valueToECTS: 59 → F', () => {
  assert.equal(valueToECTS(59), 'F');
});
test('valueToECTS: 0 → F', () => {
  assert.equal(valueToECTS(0), 'F');
});
test('valueToECTS: NaN → null', () => {
  assert.equal(valueToECTS(NaN), null);
});
test('valueToECTS: Infinity → null', () => {
  assert.equal(valueToECTS(Infinity), null);
});
test('attendanceAggregate: порожній список → attended=0, total=0, percent=NaN', () => {
  const agg = attendanceAggregate([]);
  assert.equal(agg.attended, 0);
  assert.equal(agg.total, 0);
  assert.ok(Number.isNaN(agg.percent));
});
test('attendanceAggregate: один запис → правильний відсоток', () => {
  const agg = attendanceAggregate([{ attendedLessons: 15, totalLessons: 20 }]);
  assert.equal(agg.attended, 15);
  assert.equal(agg.total, 20);
  assert.equal(agg.percent, 75);
});
test('attendanceAggregate: кілька записів підсумовуються правильно', () => {
  const list = [
    { attendedLessons: 10, totalLessons: 20 },
    { attendedLessons: 5, totalLessons: 10 },
  ];
  const agg = attendanceAggregate(list);
  assert.equal(agg.attended, 15);
  assert.equal(agg.total, 30);
  assert.equal(agg.percent, 50);
});
test('attendanceAggregate: відвідуваність 100%', () => {
  const agg = attendanceAggregate([{ attendedLessons: 20, totalLessons: 20 }]);
  assert.equal(agg.percent, 100);
});
test('buildStudentReport: повертає один рядок на студента', () => {
  const report = buildStudentReport(students, grades);
  assert.equal(report.length, 150);
});
test("buildStudentReport: кожен рядок містить обов'язкові поля", () => {
  const report = buildStudentReport(students, grades);
  for (const row of report) {
    assert.ok('id' in row);
    assert.ok('fullName' in row);
    assert.ok('group' in row);
    assert.ok('gradeCount' in row);
    assert.ok('average' in row);
    assert.ok('ects' in row);
    assert.ok('attendancePercent' in row);
  }
});
test('buildStudentReport: охоплює всі 5 груп', () => {
  const report = buildStudentReport(students, grades);
  const groups = new Set(report.map((r) => r.group));
  for (const g of GROUP_NAMES) {
    assert.ok(groups.has(g), `Відсутня група: ${g}`);
  }
  assert.equal(groups.size, 5);
});
test('buildStudentReport: кожна група має рівно 30 студентів', () => {
  const report = buildStudentReport(students, grades);
  const counts = {};
  for (const row of report) {
    counts[row.group] = (counts[row.group] || 0) + 1;
  }
  for (const g of GROUP_NAMES) {
    assert.equal(counts[g], 30, `Група ${g} повинна мати 30 студентів`);
  }
});
test('buildStudentReport: середній бал в межах [0, 100]', () => {
  const report = buildStudentReport(students, grades);
  for (const row of report) {
    if (Number.isFinite(row.average)) {
      assert.ok(row.average >= 0 && row.average <= 100);
    }
  }
});
test('buildStudentReport: ECTS має допустиме значення', () => {
  const report = buildStudentReport(students, grades);
  const valid = new Set(['A', 'B', 'C', 'D', 'E', 'F', null]);
  for (const row of report) {
    assert.ok(valid.has(row.ects), `Недопустимий ECTS: ${row.ects}`);
  }
});
test('buildStudentAverage: ідентичний результату buildStudentReport', () => {
  const r1 = buildStudentReport(students, grades);
  const r2 = buildStudentAverage(students, grades);
  assert.equal(r1.length, r2.length);
  for (let i = 0; i < r1.length; i++) {
    assert.deepEqual(r1[i], r2[i]);
  }
});
test("buildStudentReport: мемоізація — повторний виклик повертає той самий об'єкт", () => {
  const r1 = buildStudentReport(students, grades);
  const r2 = buildStudentReport(students, grades);
  assert.strictEqual(r1, r2);
});
test('buildStudentReport: студент без оцінок має average=NaN, gradeCount=0', () => {
  const solo = [{ id: 9999, fullName: 'Тест Студент', group: 'ІП-11' }];
  const result = buildStudentReport(solo, []);
  assert.equal(result.length, 1);
  assert.ok(Number.isNaN(result[0].average));
  assert.equal(result[0].gradeCount, 0);
});
test('buildStudentSubjectAverage: фільтрує за предметом правильно', () => {
  const report = buildStudentSubjectAverage(students, grades, 'Математика');
  assert.equal(report.length, 150);
  for (const row of report) {
    assert.ok(Number.isFinite(row.average) || Number.isNaN(row.average));
  }
});
test('buildStudentSubjectAverage: порожній предмет повертає NaN', () => {
  const report = buildStudentSubjectAverage(students, grades, '');
  assert.equal(report.length, 150);
  for (const row of report) {
    assert.ok(Number.isNaN(row.average));
  }
});
test('buildStudentSubjectAverage: невідомий предмет → gradeCount=0, average=NaN', () => {
  const report = buildStudentSubjectAverage(students, grades, 'Астрофізика');
  assert.equal(report.length, 150);
  for (const row of report) {
    assert.ok(Number.isNaN(row.average));
    assert.equal(row.gradeCount, 0);
  }
});
test('buildStudentSubjectAverage: пошук предмета нечутливий до регістру', () => {
  const lower = buildStudentSubjectAverage(students, grades, 'математика');
  const upper = buildStudentSubjectAverage(students, grades, 'Математика');
  for (let i = 0; i < lower.length; i++) {
    assert.equal(lower[i].gradeCount, upper[i].gradeCount);
  }
});
test("buildStudentSubjectAverage: мемоізація — однакові аргументи дають той самий об'єкт", () => {
  const r1 = buildStudentSubjectAverage(students, grades, 'Фізика');
  const r2 = buildStudentSubjectAverage(students, grades, 'Фізика');
  assert.strictEqual(r1, r2);
});
test('sortStudents: by-name — сортування за алфавітом (uk)', () => {
  const report = buildStudentReport(students, grades);
  const sorted = sortStudents(report, 'by-name');
  assert.equal(sorted.length, report.length);
  for (let i = 1; i < sorted.length; i++) {
    const cmp = sorted[i - 1].fullName.localeCompare(sorted[i].fullName, 'uk');
    assert.ok(cmp <= 0, `Порушено порядок на позиції ${i}`);
  }
});
test('sortStudents: by-average-desc — найвищий бал на початку', () => {
  const report = buildStudentReport(students, grades);
  const sorted = sortStudents(report, 'by-average-desc');
  for (let i = 1; i < sorted.length; i++) {
    const a = Number.isFinite(sorted[i - 1].average)
      ? sorted[i - 1].average
      : -Infinity;
    const b = Number.isFinite(sorted[i].average)
      ? sorted[i].average
      : -Infinity;
    assert.ok(a >= b, `Порушено спадний порядок на позиції ${i}: ${a} < ${b}`);
  }
});
test('sortStudents: by-count-desc — найбільша кількість оцінок на початку', () => {
  const report = buildStudentReport(students, grades);
  const sorted = sortStudents(report, 'by-count-desc');
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(
      sorted[i - 1].gradeCount >= sorted[i].gradeCount,
      `Порушено порядок на позиції ${i}`,
    );
  }
});
test('sortStudents: by-attendance-desc — найвища відвідуваність на початку', () => {
  const report = buildStudentReport(students, grades);
  const sorted = sortStudents(report, 'by-attendance-desc');
  for (let i = 1; i < sorted.length; i++) {
    const a = Number.isFinite(sorted[i - 1].attendancePercent)
      ? sorted[i - 1].attendancePercent
      : -Infinity;
    const b = Number.isFinite(sorted[i].attendancePercent)
      ? sorted[i].attendancePercent
      : -Infinity;
    assert.ok(a >= b, `Порушено порядок на позиції ${i}`);
  }
});
test('sortStudents: невідома стратегія → запасний варіант by-name', () => {
  const report = buildStudentReport(students, grades);
  const byName = sortStudents(report, 'by-name');
  const byUnknown = sortStudents(report, '__невідомо__');
  for (let i = 0; i < byName.length; i++) {
    assert.equal(byUnknown[i].id, byName[i].id);
  }
});
test('sortStudents: не мутує вихідний масив', () => {
  const report = buildStudentReport(students, grades);
  const original = report.map((r) => r.id);
  sortStudents(report, 'by-average-desc');
  const after = report.map((r) => r.id);
  assert.deepEqual(original, after);
});
test("sortStudents: об'єкт strategies містить всі очікувані ключі", () => {
  const expected = [
    'by-name',
    'by-average-desc',
    'by-subject-average-desc',
    'by-count-desc',
    'by-attendance-desc',
  ];
  for (const key of expected) {
    assert.ok(key in strategies, `Відсутня стратегія: ${key}`);
    assert.equal(typeof strategies[key], 'function');
  }
});
test('findStudentsByName: знаходить за частиною прізвища', () => {
  const results = findStudentsByName(students, 'коваленко');
  assert.ok(results.length > 0);
  for (const s of results) {
    assert.ok(s.fullName.toLowerCase().includes('коваленко'));
  }
});
test('findStudentsByName: пошук нечутливий до регістру', () => {
  const lower = findStudentsByName(students, 'петренко');
  const upper = findStudentsByName(students, 'ПЕТРЕНКО');
  assert.equal(lower.length, upper.length);
});
test('findStudentsByName: порожній запит повертає всіх студентів', () => {
  const results = findStudentsByName(students, '');
  assert.equal(results.length, students.length);
});
test("findStudentsByName: невідоме ім'я повертає порожній масив", () => {
  const results = findStudentsByName(students, 'Xxxxxxxxxx');
  assert.equal(results.length, 0);
});
test('findStudentsByName: "Шевченко" є в кожній групі', () => {
  const results = findStudentsByName(students, 'Шевченко');
  assert.ok(results.length > 0);
  const groups = new Set(results.map((s) => s.group));
  assert.equal(groups.size, GROUP_NAMES.length);
});
