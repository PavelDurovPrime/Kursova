const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const { log } = require('../services/logger');
const { generateReportHtml, generateReportText } = require('../services/reportExporter');
const {
  computeWebReport,
  uniqueSubjects,
  uniqueGroups,
  SubjectRequiredError
} = require('./reportApi');
const { getDataset, clearDatasetCache, resolveDataPath } = require('./dataService');
const {
  filterGradesByPeriod,
  normalizePeriod,
  attendanceAggregate,
  valueToECTS
} = require('../services/gradeService');

function normalizeBasePath(raw) {
  if (!raw || String(raw).trim() === '' || String(raw).trim() === '/') return '';
  let s = String(raw).trim();
  if (!s.startsWith('/')) s = `/${s}`;
  return s.replace(/\/$/, '');
}

const BASE_PATH = normalizeBasePath(process.env.BASE_PATH || '');
const DATA_PATH = process.env.GRADES_DATA_PATH || null;
const resolvedDataFile = resolveDataPath(DATA_PATH);

const PUBLIC_DIR = path.join(__dirname, 'public');
const INDEX_HTML = path.join(PUBLIC_DIR, 'index.html');

const app = express();

if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

const corsOrigin = process.env.CORS_ORIGIN;
if (corsOrigin !== undefined && corsOrigin !== '') {
  app.use(
    cors({
      origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
      methods: ['GET', 'HEAD', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
      maxAge: 86400
    })
  );
}

app.use(express.json({ limit: '64kb' }));

function formatAvg(value) {
  return Number.isFinite(value) ? Number(value).toFixed(2) : null;
}

function formatPct(value) {
  return Number.isFinite(value) ? Number(value).toFixed(1) : null;
}

function parseQueryParams(req) {
  return {
    group: req.query.group,
    sort: req.query.sort,
    subject: req.query.subject,
    top: req.query.top,
    query: req.query.query,
    period: req.query.period
  };
}

function isSubjectRequiredError(e) {
  return e instanceof SubjectRequiredError || e.code === 'SUBJECT_REQUIRED';
}

function serializeReportPayload(payload) {
  return {
    title: payload.title,
    period: payload.period || 'all',
    rows: payload.rows.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      group: r.group,
      average: Number.isFinite(r.average) ? r.average : null,
      averageFormatted: formatAvg(r.average),
      attendancePercent: Number.isFinite(r.attendancePercent) ? r.attendancePercent : null,
      attendanceFormatted: formatPct(r.attendancePercent) ? `${formatPct(r.attendancePercent)}%` : null
    })),
    stats: {
      bestStudent: payload.stats.bestStudent
        ? {
            id: payload.stats.bestStudent.id,
            fullName: payload.stats.bestStudent.fullName,
            group: payload.stats.bestStudent.group,
            average: Number.isFinite(payload.stats.bestStudent.average)
              ? payload.stats.bestStudent.average
              : null,
            averageFormatted: formatAvg(payload.stats.bestStudent.average)
          }
        : null,
      groupAverage: Number.isFinite(payload.stats.groupAverage) ? payload.stats.groupAverage : null,
      groupAverageFormatted: formatAvg(payload.stats.groupAverage)
    },
    scopeAverageCaption: payload.scopeAverageCaption,
    totalCount: payload.totalCount,
    shownCount: payload.shownCount
  };
}

const api = express.Router();

api.get('/', (_req, res) => {
  const root = BASE_PATH || '';
  const prefix = `${root}/api`;
  res.json({
    name: 'Kodacode API',
    version: '1.0.0',
    basePath: BASE_PATH || '/',
    endpoints: {
      health: `${prefix}/health`,
      meta: `${prefix}/meta`,
      groupRating: `${prefix}/group-rating`,
      report: `${prefix}/report`,
      studentGrades: `${prefix}/student/:id/grades`,
      export: `${prefix}/export?format=html|txt`
    },
    env: {
      dataFile: resolvedDataFile,
      trustProxy: Boolean(app.get('trust proxy'))
    }
  });
});

api.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'gradelogic',
    uptimeSec: Math.floor(process.uptime())
  });
});

api.get('/meta', async (_req, res) => {
  try {
    const { students, grades } = await getDataset(DATA_PATH);
    res.json({
      groups: uniqueGroups(students),
      subjects: uniqueSubjects(grades),
      studentCount: students.length,
      gradeCount: grades.length,
      periods: [
        { id: 'all', label: 'Навчальний рік (I + II сем.)' },
        { id: '1', label: '1 семестр' },
        { id: '2', label: '2 семестр' }
      ]
    });
  } catch (e) {
    await log('error', `Web /api/meta: ${e && e.message ? e.message : e}`);
    const msg =
      e && e.code === 'DATA_FILE_MISSING'
        ? 'Файл даних не знайдено. Перевірте GRADES_DATA_PATH або data/grades.json'
        : 'Не вдалося завантажити дані';
    res.status(500).json({ error: msg, code: e && e.code ? e.code : 'LOAD_ERROR' });
  }
});

api.get('/group-rating', async (_req, res) => {
  try {
    const { students, grades } = await getDataset(DATA_PATH);
    const groupMap = new Map();

    for (const student of students) {
      if (!groupMap.has(student.group)) {
        groupMap.set(student.group, {
          name: student.group,
          students: []
        });
      }
      groupMap.get(student.group).students.push(student);
    }

    const result = [];
    for (const group of groupMap.values()) {
      const studentAverages = group.students.map((s) => {
        const sGrades = grades.filter((g) => g.studentId === s.id);
        const avg = sGrades.length > 0 ? sGrades.reduce((sum, g) => sum + g.value, 0) / sGrades.length : 0;
        // Calculate attendance for this student
        const att = attendanceAggregate(sGrades);
        return { student: s, average: avg, attendance: att };
      });

      const groupAvg =
        studentAverages.length > 0 ? studentAverages.reduce((sum, s) => sum + s.average, 0) / studentAverages.length : 0;

      // Calculate group attendance using ALL lessons from ALL students
      const allGroupGrades = group.students.flatMap((s) => grades.filter((g) => g.studentId === s.id));
      const groupAttendance = attendanceAggregate(allGroupGrades);

      const topStudents = studentAverages
        .sort((a, b) => b.average - a.average)
        .slice(0, 3)
        .map((s) => ({
          fullName: s.student.fullName,
          average: s.average,
          averageFormatted: formatAvg(s.average)
        }));

      result.push({
        groupName: group.name,
        averageGrade: groupAvg,
        averageGradeFormatted: formatAvg(groupAvg),
        averageAttendance: Number.isFinite(groupAttendance.percent) ? groupAttendance.percent : 0,
        averageAttendanceFormatted: formatPct(groupAttendance.percent) ? `${formatPct(groupAttendance.percent)}%` : '0.0%',
        studentCount: group.students.length,
        topStudents: topStudents,
        bestStudent: topStudents[0] || null
      });
    }

    result.sort((a, b) => b.averageGrade - a.averageGrade);
    res.json(result);
  } catch (e) {
    await log('error', `Web /api/group-rating: ${e && e.message ? e.message : e}`);
    res.status(500).json({ error: 'Помилка отримання рейтингу груп', code: 'RATING_ERROR' });
  }
});

api.get('/report', async (req, res) => {
  try {
    const { students, grades } = await getDataset(DATA_PATH);
    const payload = computeWebReport(students, grades, parseQueryParams(req));
    res.json(serializeReportPayload(payload));
  } catch (e) {
    if (isSubjectRequiredError(e)) {
      return res.status(400).json({ error: e.message, code: 'SUBJECT_REQUIRED' });
    }
    await log('error', `Web /api/report: ${e && e.message ? e.message : e}`);
    res.status(500).json({ error: 'Помилка формування звіту', code: 'REPORT_ERROR' });
  }
});

api.get('/student/:id/grades', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Некоректний ID', code: 'BAD_ID' });
    }
    const periodNorm = normalizePeriod(req.query.period);
    const { students, grades } = await getDataset(DATA_PATH);
    const student = students.find((s) => s.id === id);
    if (!student) {
      return res.status(404).json({ error: 'Студента не знайдено', code: 'NOT_FOUND' });
    }
    const filtered = filterGradesByPeriod(grades, periodNorm).filter((g) => g.studentId === id);
    const items = filtered
      .map((g) => ({
        subject: g.subject,
        semester: g.semester,
        value: g.value,
        attendedLessons: g.attendedLessons,
        totalLessons: g.totalLessons,
        absences: g.totalLessons - g.attendedLessons
      }))
      .sort((a, b) => {
        const cmp = a.subject.localeCompare(b.subject, 'uk');
        if (cmp !== 0) return cmp;
        return a.semester - b.semester;
      });
    const sum = filtered.reduce((acc, g) => acc + g.value, 0);
    const avg = filtered.length > 0 ? sum / filtered.length : NaN;
    const agg = attendanceAggregate(filtered);
    res.json({
      student: { id: student.id, fullName: student.fullName, group: student.group },
      period: periodNorm,
      items,
      summary: {
        average: Number.isFinite(avg) ? avg : null,
        averageFormatted: formatAvg(avg),
        attendancePercent: Number.isFinite(agg.percent) ? agg.percent : null,
        attendanceFormatted: formatPct(agg.percent) ? `${formatPct(agg.percent)}%` : null,
        attendedLessons: agg.attended,
        totalLessons: agg.total
      }
    });
  } catch (e) {
    await log('error', `Web /api/student: ${e && e.message ? e.message : e}`);
    res.status(500).json({ error: 'Помилка завантаження оцінок', code: 'LOAD_ERROR' });
  }
});

api.get('/export', async (req, res) => {
  try {
    const format = String(req.query.format || 'html').toLowerCase() === 'txt' ? 'txt' : 'html';
    const { students, grades } = await getDataset(DATA_PATH);
    const payload = computeWebReport(students, grades, parseQueryParams(req));
    const { title, rows, stats, scopeAverageCaption } = payload;

    const safeStats = {
      bestStudent: stats.bestStudent,
      groupAverage: stats.groupAverage
    };

    const body =
      format === 'html'
        ? generateReportHtml(title, rows, safeStats, scopeAverageCaption)
        : generateReportText(title, rows, safeStats, scopeAverageCaption);

    const ext = format === 'html' ? 'html' : 'txt';
    const name = `gradelogic-report.${ext}`;
    res.setHeader('Content-Type', format === 'html' ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send(body);
  } catch (e) {
    if (isSubjectRequiredError(e)) {
      return res.status(400).json({ error: e.message, code: 'SUBJECT_REQUIRED' });
    }
    await log('error', `Web /api/export: ${e && e.message ? e.message : e}`);
    res.status(500).json({ error: 'Помилка експорту', code: 'EXPORT_ERROR' });
  }
});

api.use((_req, res) => {
  res.status(404).json({ error: 'Невідомий шлях API', code: 'NOT_FOUND' });
});

const apiMount = BASE_PATH ? `${BASE_PATH}/api` : '/api';
app.use(apiMount, api);

/** Статика + fallback на index.html (SPA) у межах BASE_PATH */
const publicApp = express.Router();
publicApp.use(
  express.static(PUBLIC_DIR, {
    index: 'index.html',
    maxAge: process.env.NODE_ENV === 'production' ? 3600000 : 0
  })
);
publicApp.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }
  res.sendFile(INDEX_HTML, (err) => {
    if (err) next(err);
  });
});

if (BASE_PATH) {
  app.use(BASE_PATH, publicApp);
} else {
  app.use(publicApp);
}

app.use((err, _req, res, _next) => {
  log('error', `Web unhandled: ${err && err.message ? err.message : err}`);
  if (!res.headersSent) {
    res.status(500).send('Internal Server Error');
  }
});

const PORT = Number.parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  try {
    await getDataset(DATA_PATH);
  } catch (e) {
    console.error('Не вдалося прочитати базу оцінок.');
    console.error(`Шлях: ${resolvedDataFile}`);
    console.error('Підказка: задайте GRADES_DATA_PATH або покладіть файл у data/grades.json');
    process.exitCode = 1;
    return;
  }

  app.listen(PORT, HOST, () => {
    const hostShown = HOST === '0.0.0.0' ? 'localhost' : HOST;
    const suffix = BASE_PATH ? `${BASE_PATH}/` : '/';
    console.log(`GradeLogic веб: http://${hostShown}:${PORT}${suffix}`);
    console.log(`API: http://${hostShown}:${PORT}${apiMount}`);
    if (BASE_PATH) {
      console.log('Якщо фронт не грузиться — у index.html задайте meta gradelogic-public-base');
    }
    log('success', `Web server listening on ${HOST}:${PORT} api=${apiMount}`);
  });
}

start();
