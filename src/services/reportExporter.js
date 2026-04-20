const fs = require('node:fs/promises');
const path = require('node:path');

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatAvg(value) {
  return Number.isFinite(value) ? Number(value).toFixed(2) : '-';
}

function formatPct(value) {
  return Number.isFinite(value) ? `${Number(value).toFixed(1)}%` : '-';
}

function generateRowsHtml(rows) {
  const header = `
    <tr>
      <th>ПІБ</th>
      <th>Група</th>
      <th>Оцінок</th>
      <th>Середній бал</th>
      <th>Відвідування</th>
    </tr>
  `;

  const body = rows
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.fullName)}</td>
        <td>${escapeHtml(r.group)}</td>
        <td>${escapeHtml(String(r.gradeCount ?? '—'))}</td>
        <td>${escapeHtml(formatAvg(r.average))}</td>
        <td>${escapeHtml(formatPct(r.attendancePercent))}</td>
      </tr>
    `,
    )
    .join('\n');

  return header + body;
}

function generateReportText(
  title,
  rows,
  stats,
  scopeAverageCaption = 'Загальний середній бал по групі',
) {
  const lines = [];
  lines.push(title);
  lines.push('');
  lines.push('ПІБ                  | Група | Оц. | Середн. | Відвід.%');
  lines.push('---------------------|-------|-----|---------|--------');
  for (const s of rows) {
    lines.push(
      `${String(s.fullName).padEnd(20, ' ')} | ${String(s.group).padEnd(5, ' ')} | ${String(s.gradeCount).padEnd(3, ' ')} | ${formatAvg(s.average).padStart(7, ' ')} | ${formatPct(s.attendancePercent).padStart(6, ' ')}`,
    );
  }
  lines.push('');

  if (stats.bestStudent) {
    lines.push(
      `Найкращий студент курсу: ${stats.bestStudent.fullName} (${stats.bestStudent.group}) — ${formatAvg(
        stats.bestStudent.average,
      )}`,
    );
  } else {
    lines.push('Найкращий студент курсу: —');
  }

  lines.push(`${scopeAverageCaption}: ${formatAvg(stats.groupAverage)}`);
  lines.push('');

  return lines.join('\n');
}

function generateReportHtml(
  title,
  rows,
  stats,
  scopeAverageCaption = 'Загальний середній бал по групі',
) {
  const bestLine = stats.bestStudent
    ? `Найкращий студент курсу: ${escapeHtml(stats.bestStudent.fullName)} (${escapeHtml(
        stats.bestStudent.group,
      )}) — ${escapeHtml(formatAvg(stats.bestStudent.average))}`
    : 'Найкращий студент курсу: —';

  const groupLine = `${escapeHtml(scopeAverageCaption)}: ${escapeHtml(formatAvg(stats.groupAverage))}`;

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 16px; color: #111; }
    h1 { font-size: 20px; margin: 0 0 12px 0; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #333; padding: 8px; text-align: left; }
    th { background: #f2f2f2; }
    .footer { margin-top: 14px; padding: 12px; border: 1px solid #ddd; background: #fffbe6; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <table>
    ${generateRowsHtml(rows)}
  </table>
  <div class="footer">
    <div>${bestLine}</div>
    <div style="margin-top:6px;">${groupLine}</div>
  </div>
</body>
</html>`;
}

async function saveReportToFile({
  title,
  rows,
  stats,
  format = 'txt',
  scopeAverageCaption,
}) {
  const reportsDir = path.join(process.cwd(), 'reports');
  await fs.mkdir(reportsDir, { recursive: true });

  const now = new Date();
  const dateStr = now.toISOString().replace(/[:T]/g, '-').slice(0, 19);

  const safeFormat = String(format).toLowerCase() === 'html' ? 'html' : 'txt';
  const extension = safeFormat === 'html' ? 'html' : 'txt';

  const filePath = path.join(reportsDir, `report_${dateStr}.${extension}`);

  const content =
    safeFormat === 'html'
      ? generateReportHtml(title, rows, stats, scopeAverageCaption)
      : generateReportText(title, rows, stats, scopeAverageCaption);

  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
}

module.exports = {
  escapeHtml,
  formatPct,
  generateReportText,
  generateReportHtml,
  saveReportToFile,
};
