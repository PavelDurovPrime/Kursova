const fs = require('node:fs/promises');
const path = require('node:path');
const Ajv = require('ajv');
const { Student } = require('../models/Student');
const { Grade } = require('../models/Grade');
const { log } = require('../services/logger');

function createSchema() {
  return {
    type: 'object',
    required: ['students', 'grades'],
    properties: {
      students: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'fullName', 'group'],
          properties: {
            id: { type: 'integer' },
            fullName: { type: 'string', minLength: 1 },
            group: { type: 'string', minLength: 1 }
          },
          additionalProperties: false
        }
      },
      grades: {
        type: 'array',
        items: {
          type: 'object',
          required: ['studentId', 'subject', 'value'],
          properties: {
            studentId: { type: 'integer' },
            subject: { type: 'string', minLength: 1 },
            value: { type: 'number', minimum: 0, maximum: 100 },
            semester: { type: 'integer', enum: [1, 2] },
            attendedLessons: { type: 'integer', minimum: 0 },
            totalLessons: { type: 'integer', minimum: 1 }
          },
          additionalProperties: false
        }
      }
    },
    additionalProperties: false
  };
}

function validateUniqueness(students) {
  const ids = new Set();
  const fullNames = new Set();
  for (const s of students) {
    if (ids.has(s.id)) return false;
    if (fullNames.has(s.fullName)) return false;
    ids.add(s.id);
    fullNames.add(s.fullName);
  }
  return true;
}

function normalizeGradeRecord(g) {
  const semester = g.semester === 2 ? 2 : 1;
  const totalLessons =
    Number.isFinite(g.totalLessons) && g.totalLessons >= 1 ? Math.floor(g.totalLessons) : 28;
  let attended = Number.isFinite(g.attendedLessons) ? Math.floor(g.attendedLessons) : null;
  if (attended === null) {
    const seed = (g.studentId * 17 + String(g.subject).length * 3 + semester * 11 + g.value) % 100;
    attended = Math.round(totalLessons * (0.55 + seed / 250));
  }
  attended = Math.min(Math.max(0, attended), totalLessons);
  return {
    studentId: g.studentId,
    subject: g.subject,
    value: g.value,
    semester,
    attendedLessons: attended,
    totalLessons
  };
}

function validateGradeUniqueness(normalizedGrades) {
  const seen = new Set();
  for (const g of normalizedGrades) {
    const key = `${g.studentId}|${g.subject}|${g.semester}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

function validateDataStructure(parsed) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const schema = createSchema();
  const validate = ajv.compile(schema);

  const ok = validate(parsed);
  if (!ok) return false;

  const students = (parsed.students || []).map((s) => ({
    id: s.id,
    fullName: s.fullName
  }));

  if (!validateUniqueness(students)) return false;

  const normalized = (parsed.grades || []).map(normalizeGradeRecord);
  return validateGradeUniqueness(normalized);
}

async function loadData(filePath) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

  let raw;
  try {
    raw = await fs.readFile(fullPath, 'utf8');
  } catch (e) {
    const err = new Error('DATA_READ_ERROR');
    err.code = 'DATA_READ_ERROR';
    throw err;
  }

  if (!String(raw).trim()) {
    const err = new Error('DATA_READ_ERROR');
    err.code = 'DATA_READ_ERROR';
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const err = new Error('DATA_READ_ERROR');
    err.code = 'DATA_READ_ERROR';
    throw err;
  }

  const isValidStructure = validateDataStructure(parsed);
  if (!isValidStructure) {
    const err = new Error('DATA_VALIDATION_ERROR');
    err.code = 'DATA_VALIDATION_ERROR';
    throw err;
  }

  const parsedStudents = parsed.students || [];
  const parsedGradesRaw = parsed.grades || [];
  /** Якщо у файлі немає студентів або оцінок — генеруємо демо-потік 150 осіб (2 семестри). Інакше беремо дані з файлу. */
  const shouldGenerateStream = parsedStudents.length < 1 || parsedGradesRaw.length < 1;

  const defaultSubjects = ['Програмування', 'Математика', 'Фізика'];
  const parsedSubjects = [...new Set(parsedGradesRaw.map((g) => g.subject))];
  const subjects = parsedSubjects.length > 0 ? parsedSubjects.slice(0, defaultSubjects.length) : defaultSubjects;

  if (shouldGenerateStream) {
    const targetStudentsCount = 150;
    const groupNames = ['ІТ-Група А', 'ІТ-Група Б', 'Дані-Група В', 'Безпека-Група Г', 'ПЗ-Група Д'];
    const firstNames = ['Іван', 'Олена', 'Максим', 'Анна', 'Петро'];
    const middleNames = ['Іванович', 'Олександрович', 'Дмитрович', 'Сергійович', 'Миколайович'];
    const lastNames = [
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
      'Савчук'
    ];

    const subjectRules = {
      Програмування: { base: 60, mod: 41, mul: 7 },
      Математика: { base: 50, mod: 51, mul: 11 },
      Фізика: { base: 55, mod: 46, mul: 13 }
    };

    const students = [];
    const grades = [];

    for (let i = 0; i < targetStudentsCount; i += 1) {
      const id = i + 1;
      const groupIndex = Math.floor(i / 30);
      const firstIndex = groupIndex;

      const fullName = `${lastNames[i % lastNames.length]} ${firstNames[firstIndex]} ${middleNames[i % middleNames.length]}`;
      const group = groupNames[groupIndex];

      students.push(new Student(id, fullName, group));

      for (const subject of subjects) {
        for (const semester of [1, 2]) {
          const rule = subjectRules[subject] || { base: 50, mod: 51, mul: 17 };
          const shift = semester === 2 ? 3 : 0;
          const value = Math.min(100, rule.base + shift + ((id * rule.mul + semester * 5) % rule.mod));
          const totalLessons = 22 + ((id + semester + subject.length) % 11);
          const ratio = 0.52 + ((id * 13 + semester * 17 + subject.charCodeAt(0)) % 45) / 100;
          const attendedLessons = Math.min(totalLessons, Math.round(totalLessons * ratio));

          grades.push(new Grade(id, subject, value, semester, attendedLessons, totalLessons));
        }
      }
    }

    await log('success', `Stream generated: students=${students.length}, grades=${grades.length}`);
    return { students, grades };
  }

  const students = parsedStudents.map((s) => new Student(s.id, s.fullName, s.group));
  const normalized = (parsed.grades || []).map(normalizeGradeRecord);
  const grades = normalized.map(
    (g) => new Grade(g.studentId, g.subject, g.value, g.semester, g.attendedLessons, g.totalLessons)
  );
  return { students, grades };
}

module.exports = { loadData };
