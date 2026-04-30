'use strict';

const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const YAML = require('yamljs');
const swaggerUi = require('swagger-ui-express');
const { log } = require('../services/logger');
const { computeWebReport } = require('./reportApi');
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
const { parseGradesCsv } = require('../services/importService');
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

const upload = multer({ storage: multer.memoryStorage() });
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
});

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
      const query = {
        ...req.query,
        page: undefined,
        limit: undefined,
      };
      const cacheKey = `v1:report:${getDatasetVersion()}:${JSON.stringify(query)}:${page}:${limit}`;
      const cached = await cacheGet(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const { students, grades } = await getDataset(dataPath);
      const payload = computeWebReport(students, grades, query);
      const pagedRows = paginateItems(payload.rows, page, limit);
      const responsePayload = {
        title: payload.title,
        period: payload.period,
        stats: payload.stats,
        scopeAverageCaption: payload.scopeAverageCaption,
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
    async (req, res) => {
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
      const csv = req.file.buffer.toString('utf8');
      const parsed = parseGradesCsv(csv);
      if (!dryRun) {
        await sqliteRepository.createManyGrades(parsed);
        await sqliteRepository.writeAuditLog({
          actorId: req.user.sub,
          action: 'grade.import',
          entity: 'grade',
          entityId: 'bulk',
          payload: { count: parsed.length },
        });
        await cacheDeleteByPrefix('v1:report:');
        bumpDatasetRevision();
        broadcast('grade.updated', { action: 'import', count: parsed.length });
      }
      return res.json({
        dryRun,
        parsedCount: parsed.length,
        sample: parsed.slice(0, 5),
      });
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

    const topStudents = queue.getTopN(limit);

    res.json({
      students: topStudents,
      total: queue.size(),
      limit,
    });
  });

  router.use((error, _req, res) => {
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
