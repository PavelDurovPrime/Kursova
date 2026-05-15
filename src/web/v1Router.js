'use strict';
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const YAML = require('yamljs');
const swaggerUi = require('swagger-ui-express');
const os = require('node:os');
const fs = require('node:fs');
const { parse } = require('csv-parse');
const { log } = require('../services/logger');
const {
  computeWebReport,
  uniqueSubjects,
  uniqueGroups,
  SubjectRequiredError,
} = require('./reportApi');
const { getDatasetVersion, bumpDatasetRevision } = require('./dataService');
const { parsePagination, paginateItems } = require('./middlewares/pagination');
const { validate } = require('./middlewares/validate');
const { loginSchema } = require('./schemas/auth.schema');
const {
  gradeCreateSchema,
  gradePatchSchema,
} = require('./schemas/grade.schema');
const { reportQuerySchema } = require('./schemas/common.schema');
const { authenticate, issueToken, requireRole } = require('./middlewares/auth');
const { validateCredentials } = require('../services/authService');
const { sqliteRepository } = require('../repository/repositoryFactory');
const { prisma } = require('../repository/sqlite/prismaClient');
const {
  cacheGet,
  cacheSet,
  cacheDeleteByPrefix,
} = require('../services/cacheService');
const { broadcast } = require('../services/realtimeService');
const {
  createAuthProxy,
  createRateLimiter,
} = require('./middlewares/authProxy');
const { PriorityDeque } = require('../lib/priorityQueue');
const { publishDomainEvent } = require('../services/domainEvents');
const {
  generateReportHtml,
  generateReportText,
} = require('../services/reportExporter');
const {
  filterGradesByPeriod,
  normalizePeriod,
  attendanceAggregate,
} = require('../services/gradeService');
const upload = multer({ dest: os.tmpdir() });
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
});
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
    period: req.query.period,
  };
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
      attendancePercent: Number.isFinite(r.attendancePercent)
        ? r.attendancePercent
        : null,
      attendanceFormatted: formatPct(r.attendancePercent)
        ? `${formatPct(r.attendancePercent)}%`
        : null,
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
            averageFormatted: formatAvg(payload.stats.bestStudent.average),
          }
        : null,
      groupAverage: Number.isFinite(payload.stats.groupAverage)
        ? payload.stats.groupAverage
        : null,
      groupAverageFormatted: formatAvg(payload.stats.groupAverage),
    },
    scopeAverageCaption: payload.scopeAverageCaption,
    totalCount: payload.totalCount,
    shownCount: payload.shownCount,
  };
}
function makeApiV1Router({ dataPath, getDataset }) {
  const router = express.Router();
  const openApiDoc = YAML.load('docs/openapi.yaml');
  router.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDoc));
  router.get('/health', (_req, res) => {
    res.json({
      ok: true,
      version: 'v1',
      uptimeSec: Math.floor(process.uptime()),
    });
  });
  router.get('/meta', async (_req, res) => {
    try {
      const { students, grades } = await getDataset(dataPath);
      publishDomainEvent('api.meta.requested', {
        studentCount: students.length,
        gradeCount: grades.length,
      });
      return res.json({
        groups: uniqueGroups(students),
        subjects: uniqueSubjects(grades),
        studentCount: students.length,
        gradeCount: grades.length,
        periods: [
          { id: 'all', label: 'Навчальний рік (I + II сем.)' },
          { id: '1', label: '1 семестр' },
          { id: '2', label: '2 семестр' },
        ],
      });
    } catch (e) {
      await log('error', `Web /api/v1/meta: ${e && e.message ? e.message : e}`);
      const msg =
        e && e.code === 'DATA_FILE_MISSING'
          ? 'Файл даних не знайдено. Перевірте GRADES_DATA_PATH або data/grades.json'
          : 'Не вдалося завантажити дані';
      return res
        .status(500)
        .json({ error: msg, code: e && e.code ? e.code : 'LOAD_ERROR' });
    }
  });
  router.get('/group-rating', async (_req, res) => {
    try {
      const { students, grades } = await getDataset(dataPath);
      const groupMap = new Map();
      for (const student of students) {
        if (!groupMap.has(student.group)) {
          groupMap.set(student.group, {
            name: student.group,
            students: [],
          });
        }
        groupMap.get(student.group).students.push(student);
      }
      const result = [];
      for (const group of groupMap.values()) {
        const studentAverages = group.students.map((s) => {
          const sGrades = grades.filter((g) => g.studentId === s.id);
          const avg =
            sGrades.length > 0
              ? sGrades.reduce((sum, g) => sum + g.value, 0) / sGrades.length
              : 0;
          const att = attendanceAggregate(sGrades);
          return { student: s, average: avg, attendance: att };
        });
        const groupAvg =
          studentAverages.length > 0
            ? studentAverages.reduce((sum, s) => sum + s.average, 0) /
              studentAverages.length
            : 0;
        const allGroupGrades = group.students.flatMap((s) =>
          grades.filter((g) => g.studentId === s.id),
        );
        const groupAttendance = attendanceAggregate(allGroupGrades);
        const topStudents = studentAverages
          .sort((a, b) => b.average - a.average)
          .slice(0, 3)
          .map((s) => ({
            fullName: s.student.fullName,
            average: s.average,
            averageFormatted: formatAvg(s.average),
          }));
        result.push({
          groupName: group.name,
          averageGrade: groupAvg,
          averageGradeFormatted: formatAvg(groupAvg),
          averageAttendance: Number.isFinite(groupAttendance.percent)
            ? groupAttendance.percent
            : 0,
          averageAttendanceFormatted: formatPct(groupAttendance.percent)
            ? `${formatPct(groupAttendance.percent)}%`
            : '0.0%',
          studentCount: group.students.length,
          topStudents,
          bestStudent: topStudents[0] || null,
        });
      }
      result.sort((a, b) => b.averageGrade - a.averageGrade);
      publishDomainEvent('api.groupRating.requested', {
        groups: result.length,
      });
      return res.json(result);
    } catch (e) {
      await log(
        'error',
        `Web /api/v1/group-rating: ${e && e.message ? e.message : e}`,
      );
      return res.status(500).json({
        error: 'Помилка отримання рейтингу груп',
        code: 'RATING_ERROR',
      });
    }
  });
  router.get('/export', async (req, res) => {
    try {
      const format =
        String(req.query.format || 'html').toLowerCase() === 'txt'
          ? 'txt'
          : 'html';
      const { students, grades } = await getDataset(dataPath);
      const payload = computeWebReport(students, grades, parseQueryParams(req));
      const { title, rows, stats, scopeAverageCaption } = payload;
      const safeStats = {
        bestStudent: stats.bestStudent,
        groupAverage: stats.groupAverage,
      };
      const body =
        format === 'html'
          ? generateReportHtml(title, rows, safeStats, scopeAverageCaption)
          : generateReportText(title, rows, safeStats, scopeAverageCaption);
      const ext = format === 'html' ? 'html' : 'txt';
      const name = `gradelogic-report.${ext}`;
      res.setHeader(
        'Content-Type',
        format === 'html'
          ? 'text/html; charset=utf-8'
          : 'text/plain; charset=utf-8',
      );
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
      publishDomainEvent('api.export.requested', {
        format,
        rows: rows.length,
        period: payload.period,
      });
      return res.send(body);
    } catch (e) {
      if (e instanceof SubjectRequiredError || e.code === 'SUBJECT_REQUIRED') {
        return res
          .status(400)
          .json({ error: e.message, code: 'SUBJECT_REQUIRED' });
      }
      await log(
        'error',
        `Web /api/v1/export: ${e && e.message ? e.message : e}`,
      );
      return res
        .status(500)
        .json({ error: 'Помилка експорту', code: 'EXPORT_ERROR' });
    }
  });
  router.get('/student/:id/grades', async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) {
        return res
          .status(400)
          .json({ error: 'Некоректний ID', code: 'BAD_ID' });
      }
      const periodNorm = normalizePeriod(req.query.period);
      const { students, grades } = await getDataset(dataPath);
      const student = students.find((s) => s.id === id);
      if (!student) {
        return res
          .status(404)
          .json({ error: 'Студента не знайдено', code: 'NOT_FOUND' });
      }
      const filtered = filterGradesByPeriod(grades, periodNorm).filter(
        (g) => g.studentId === id,
      );
      const items = filtered
        .map((g) => ({
          gradeId: Number.isFinite(g.id) ? g.id : null,
          subject: g.subject,
          semester: g.semester,
          value: g.value,
          attendedLessons: g.attendedLessons,
          totalLessons: g.totalLessons,
          absences: g.totalLessons - g.attendedLessons,
        }))
        .sort((a, b) => {
          const cmp = a.subject.localeCompare(b.subject, 'uk');
          if (cmp !== 0) return cmp;
          return a.semester - b.semester;
        });
      const sum = filtered.reduce((acc, g) => acc + g.value, 0);
      const avg = filtered.length > 0 ? sum / filtered.length : NaN;
      const agg = attendanceAggregate(filtered);
      return res.json({
        student: {
          id: student.id,
          fullName: student.fullName,
          group: student.group,
        },
        period: periodNorm,
        items,
        summary: {
          average: Number.isFinite(avg) ? avg : null,
          averageFormatted: formatAvg(avg),
          attendancePercent: Number.isFinite(agg.percent) ? agg.percent : null,
          attendanceFormatted: formatPct(agg.percent)
            ? `${formatPct(agg.percent)}%`
            : null,
          attendedLessons: agg.attended,
          totalLessons: agg.total,
        },
      });
    } catch (e) {
      await log(
        'error',
        `Web /api/v1/student: ${e && e.message ? e.message : e}`,
      );
      return res
        .status(500)
        .json({ error: 'Помилка завантаження оцінок', code: 'LOAD_ERROR' });
    }
  });
  router.post(
    '/auth/login',
    authLimiter,
    validate(loginSchema),
    async (req, res) => {
      const user = await validateCredentials(req.body.email, req.body.password);
      if (!user) {
        return res.status(401).json({
          code: 'INVALID_CREDENTIALS',
          message: 'Wrong email or password',
          details: null,
        });
      }
      const token = issueToken(user);
      return res.json({ token, user });
    },
  );
  router.get(
    '/report',
    validate(reportQuerySchema, 'query'),
    async (req, res) => {
      const { page, limit } = parsePagination(req.query.page, req.query.limit);
      const query = { ...req.query, page: undefined, limit: undefined };
      const cacheKey = `v1:report:${getDatasetVersion()}:${JSON.stringify(query)}:${page}:${limit}`;
      const cached = await cacheGet(cacheKey);
      if (cached) {
        return res.json(cached);
      }
      const { students, grades } = await getDataset(dataPath);
      const payload = computeWebReport(students, grades, query);
      const serialized = serializeReportPayload(payload);
      const pagedRows = paginateItems(serialized.rows, page, limit);
      const responsePayload = {
        title: serialized.title,
        period: serialized.period,
        stats: serialized.stats,
        scopeAverageCaption: serialized.scopeAverageCaption,
        pagination: {
          page: pagedRows.page,
          limit: pagedRows.limit,
          totalCount: pagedRows.totalCount,
          totalPages: pagedRows.totalPages,
        },
        rows: pagedRows.items,
      };
      await cacheSet(cacheKey, responsePayload, 60);
      return res.json(responsePayload);
    },
  );
  router.post(
    '/grades',
    authenticate,
    requireRole(['admin', 'teacher']),
    validate(gradeCreateSchema),
    async (req, res) => {
      const grade = await sqliteRepository.createGrade(req.body);
      await sqliteRepository.writeAuditLog({
        actorId: req.user.sub,
        action: 'grade.create',
        entity: 'grade',
        entityId: grade.id,
        payload: req.body,
      });
      await cacheDeleteByPrefix('v1:report:');
      bumpDatasetRevision();
      broadcast('grade.updated', { action: 'create', grade });
      return res.status(201).json({ item: grade });
    },
  );
  router.patch(
    '/grades/:id',
    authenticate,
    requireRole(['admin', 'teacher']),
    validate(gradePatchSchema),
    async (req, res) => {
      const gradeId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(gradeId)) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Grade ID must be a number',
          details: null,
        });
      }
      const updated = await sqliteRepository.updateGrade(gradeId, req.body);
      await sqliteRepository.writeAuditLog({
        actorId: req.user.sub,
        action: 'grade.update',
        entity: 'grade',
        entityId: gradeId,
        payload: req.body,
      });
      await cacheDeleteByPrefix('v1:report:');
      bumpDatasetRevision();
      broadcast('grade.updated', { action: 'update', grade: updated });
      return res.json({ item: updated });
    },
  );
  router.delete(
    '/grades/:id',
    authenticate,
    requireRole(['admin']),
    async (req, res) => {
      const gradeId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(gradeId)) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Grade ID must be a number',
          details: null,
        });
      }
      await sqliteRepository.deleteGrade(gradeId);
      await sqliteRepository.writeAuditLog({
        actorId: req.user.sub,
        action: 'grade.delete',
        entity: 'grade',
        entityId: gradeId,
        payload: {},
      });
      await cacheDeleteByPrefix('v1:report:');
      bumpDatasetRevision();
      broadcast('grade.updated', { action: 'delete', gradeId });
      return res.status(204).send();
    },
  );
  router.post(
    '/grades/import',
    authenticate,
    requireRole(['admin', 'teacher']),
    upload.single('file'),
    async (req, res, next) => {
      const dryRunValue = String(req.body?.dryRun || 'true').toLowerCase();
      const dryRun = dryRunValue === 'true';
      if (typeof dryRun !== 'boolean') {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'dryRun must be boolean',
          details: null,
        });
      }
      if (!req.file) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'CSV file is required',
          details: null,
        });
      }
      const controller = new AbortController();
      res.on('close', () => {
        if (!res.headersSent) controller.abort();
      });
      const parser = fs
        .createReadStream(req.file.path)
        .pipe(parse({ columns: true, skipEmptyLines: true, trim: true }));
      let parsedCount = 0;
      let currentBatch = [];
      const BATCH_SIZE = 500;
      let errorOccurred = false;
      const sample = [];
      try {
        for await (const record of parser) {
          if (controller.signal.aborted) break;
          const mapped = {
            studentId: Number.parseInt(record.studentId, 10),
            subject: record.subject,
            value: Number(record.value),
            semester: Number.parseInt(record.semester, 10),
            attendedLessons: Number.parseInt(record.attendedLessons, 10),
            totalLessons: Number.parseInt(record.totalLessons, 10),
          };
          if (sample.length < 5) sample.push(mapped);
          currentBatch.push(mapped);
          parsedCount++;
          if (currentBatch.length >= BATCH_SIZE) {
            if (!dryRun) {
              await sqliteRepository.createManyGrades(currentBatch, {
                signal: controller.signal,
              });
            }
            currentBatch = [];
          }
        }
        if (currentBatch.length > 0 && !dryRun && !controller.signal.aborted) {
          await sqliteRepository.createManyGrades(currentBatch, {
            signal: controller.signal,
          });
        }
      } catch (err) {
        errorOccurred = true;
        if (err.name === 'AbortError') {
          return res.status(499).json({
            code: 'IMPORT_ABORTED',
            message: 'Import was cancelled by client disconnect',
            details: null,
          });
        }
        next(err);
      } finally {
        fs.unlink(req.file.path, () => {});
      }
      if (controller.signal.aborted) {
        return res.end();
      }
      if (!dryRun && !errorOccurred) {
        await sqliteRepository.writeAuditLog({
          actorId: req.user.sub,
          action: 'grade.import',
          entity: 'grade',
          entityId: 'bulk',
          payload: { count: parsedCount },
        });
        await cacheDeleteByPrefix('v1:report:');
        bumpDatasetRevision();
        broadcast('grade.updated', { action: 'import', count: parsedCount });
      }
      return res.json({ dryRun, parsedCount, sample });
    },
  );
  router.get(
    '/audit',
    authenticate,
    requireRole(['admin', 'teacher']),
    async (req, res) => {
      const { page, limit } = parsePagination(req.query.page, req.query.limit);
      const result = await sqliteRepository.listAuditLogs({
        page,
        limit,
        action: req.query.action,
        entity: req.query.entity,
      });
      res.json({
        pagination: {
          page,
          limit,
          totalCount: result.total,
          totalPages: Math.max(1, Math.ceil(result.total / limit)),
        },
        items: result.items,
      });
    },
  );
  router.get('/periods', authenticate, async (_req, res) => {
    const items = await prisma.academicPeriod.findMany({
      orderBy: { startDate: 'desc' },
    });
    res.json({ items });
  });
  router.post(
    '/periods',
    authenticate,
    requireRole(['admin', 'teacher']),
    async (req, res) => {
      const item = await prisma.academicPeriod.create({
        data: {
          code: String(req.body.code),
          label: String(req.body.label),
          isActive: Boolean(req.body.isActive),
          startDate: new Date(req.body.startDate),
          endDate: new Date(req.body.endDate),
        },
      });
      await sqliteRepository.writeAuditLog({
        actorId: req.user.sub,
        action: 'period.create',
        entity: 'period',
        entityId: item.id,
        payload: item,
      });
      res.status(201).json({ item });
    },
  );
  router.use(createAuthProxy());
  router.use(createRateLimiter({ maxRequests: 100, windowMs: 60 * 1000 }));
  router.get('/top-students', authenticate, async (req, res) => {
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 10, 50);
    const students = await prisma.student.findMany({
      include: { grades: true },
    });
    const queue = new PriorityDeque({
      compare: (a, b) => b.priority - a.priority,
    });
    students.forEach((student) => {
      const avg =
        student.grades.length > 0
          ? student.grades.reduce((sum, g) => sum + (g.score || 0), 0) /
            student.grades.length
          : 0;
      queue.enqueue(
        {
          id: student.id,
          fullName: student.fullName,
          group: student.group,
          average: avg.toFixed(2),
          gradeCount: student.grades.length,
        },
        avg,
      );
    });
    res.json({ students: queue.getTopN(limit), total: queue.size(), limit });
  });
  // eslint-disable-next-line no-unused-vars
  router.use((error, _req, res, _next) => {
    log(
      'error',
      `API v1 error: ${error && error.message ? error.message : error}`,
    );
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: null,
    });
  });
  return router;
}
module.exports = { makeApiV1Router };
