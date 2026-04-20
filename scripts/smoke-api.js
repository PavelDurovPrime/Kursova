'use strict';

/**
 * Перевірка живого сервера: health → login → report (потрібен запущений `npm run web`).
 * BASE=http://127.0.0.1:3000 npm run smoke:api
 */

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const EMAIL = process.env.SMOKE_EMAIL || 'teacher@gradelogic.local';
const PASSWORD = process.env.SMOKE_PASSWORD || 'teacher123';

async function main() {
  const healthUrl = new URL('/api/v1/health', BASE);
  const loginUrl = new URL('/api/v1/auth/login', BASE);
  const reportUrl = new URL('/api/v1/report?page=1&limit=3', BASE);

  const h = await fetch(healthUrl);
  if (!h.ok) throw new Error(`health ${h.status}`);
  const health = await h.json();
  if (!health.ok) throw new Error('health body not ok');

  const loginRes = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!loginRes.ok) {
    const t = await loginRes.text();
    throw new Error(`login ${loginRes.status}: ${t}`);
  }
  const { token } = await loginRes.json();
  if (!token) throw new Error('no token');

  const reportRes = await fetch(reportUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!reportRes.ok) {
    const t = await reportRes.text();
    throw new Error(`report ${reportRes.status}: ${t}`);
  }
  const report = await reportRes.json();
  if (!report.pagination || !Array.isArray(report.rows)) {
    throw new Error('unexpected report shape');
  }

  console.log('smoke:api OK', {
    health: health.version,
    rows: report.rows.length,
  });
}

main().catch((err) => {
  console.error('smoke:api FAILED', err.message);
  process.exitCode = 1;
});
