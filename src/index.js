const readline = require('node:readline');
const chalk = require('chalk').default;
const path = require('node:path');
const { loadData } = require('./repository/gradeRepository');
const { log } = require('./services/logger');
const { saveReportToFile } = require('./services/reportExporter');
const {
  buildStudentReport,
  buildStudentAverage,
  buildStudentSubjectAverage,
  sortStudents,
  findStudentsByName,
  filterGradesByPeriod,
  normalizePeriod
} = require('./services/gradeService');
const { buildReportStats, applyGroupFilter, buildReportView } = require('./reportView');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value && !value.startsWith('--')) {
      args[key] = value;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function formatAvg(value) {
  return Number.isFinite(value) ? Number(value).toFixed(2) : '-';
}

function formatPct(value) {
  return Number.isFinite(value) ? `${Number(value).toFixed(1)}%` : '-';
}

function printStudentsTable(rows) {
  console.log(
    'ПІБ                            | Група             | Оц. | Середн. | Відвід.%'
  );
  console.log('-------------------------------|------------------|-----|---------|--------');

  for (const r of rows) {
    const fullNameStr = String(r.fullName).padEnd(30, ' ');
    const groupStr = String(r.group).padEnd(16, ' ');
    const cnt = String(r.gradeCount ?? '—').padEnd(3, ' ');
    const avgStr = formatAvg(r.average).padStart(7, ' ');
    const attStr = formatPct(r.attendancePercent).padStart(6, ' ');

    console.log(`${fullNameStr} | ${groupStr} | ${cnt} | ${avgStr} | ${attStr}`);
  }
}

function printReportFooter(stats, scopeAverageCaption) {
  const yellow = (text) => chalk.yellow(text);
  if (stats.bestStudent) {
    console.log(
      yellow(
        `Найкращий студент курсу: ${stats.bestStudent.fullName} (${stats.bestStudent.group}) — ${formatAvg(
          stats.bestStudent.average
        )}`
      )
    );
  } else {
    console.log(yellow('Найкращий студент курсу: —'));
  }

  console.log(yellow(`${scopeAverageCaption}: ${formatAvg(stats.groupAverage)}`));
}

function normalizeFormat(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === 'html' ? 'html' : 'txt';
}

function parseTopArg(args) {
  if (args.top === undefined) return null;
  const n = Number.parseInt(String(args.top), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function showMenu(students, allGrades) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) =>
    new Promise((resolve) => {
      rl.question(q, (answer) => resolve(answer));
    });

  const groupNames = Array.from(new Set(students.map((s) => s.group))).sort();

  const choosePeriod = async () => {
    console.log('');
    console.log('Період:');
    console.log('1 — навчальний рік (обидва семестри)');
    console.log('2 — 1 семестр');
    console.log('3 — 2 семестр');
    const c = String(await ask('Ваш вибір [1]: ')).trim();
    if (c === '2') return '1';
    if (c === '3') return '2';
    return 'all';
  };

  const chooseScope = async (grades) => {
    console.log('');
    console.log('Показати звіт:');
    console.log('1 — весь потік');
    console.log('2 — конкретна група');
    const scopeChoice = String(await ask('Ваш вибір: ')).trim();

    if (scopeChoice === '1' || !scopeChoice) {
      return applyGroupFilter(students, grades, null);
    }

    const n = Number(scopeChoice);
    if (n !== 2) return applyGroupFilter(students, grades, null);

    console.log('');
    console.log('Доступні групи:');
    groupNames.forEach((g, idx) => console.log(`${idx + 1} — ${g}`));

    const picked = Number(String(await ask('Оберіть номер групи: ')).trim());
    if (!Number.isFinite(picked) || picked < 1 || picked > groupNames.length) return applyGroupFilter(students, grades, null);

    const groupName = groupNames[picked - 1];
    return applyGroupFilter(students, grades, groupName);
  };

  let currentReport = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    console.log('');
    console.log('Меню:');
    console.log('1 — Вивести загальний звіт.');
    console.log('2 — Відсортувати за ПІБ.');
    console.log('3 — Відсортувати за середнім балом (усі предмети).');
    console.log('4 — Відсортувати за балом конкретного предмета.');
    console.log('5 — Відсортувати за відвідуваністю (%).');
    console.log('6 — Зберегти поточний звіт у файл.');
    console.log('0 — Вихід.');

    const choice = String(await ask('Ваш вибір: ')).trim();
    if (!process.stdin.isTTY && (!choice || choice === 'undefined')) {
      break;
    }
    const n = Number(choice);

    if (n === 0) break;

    const periodKey = await choosePeriod();
    const periodGrades = filterGradesByPeriod(allGrades, periodKey);

    if (n === 1) {
      const scope = await chooseScope(periodGrades);
      const rows = buildStudentReport(scope.scopedStudents, scope.scopedGrades);
      const stats = buildReportStats(rows);
      const title = `Загальний звіт по студентах — ${scope.scopeLabel}`;
      currentReport = {
        title,
        rows,
        stats,
        scopeAverageCaption: scope.scopeAverageCaption
      };

      console.log(`\n${title}`);
      printStudentsTable(rows);
      printReportFooter(stats, scope.scopeAverageCaption);
    } else if (n === 2) {
      const scope = await chooseScope(periodGrades);
      currentReport = buildReportView({
        students: scope.scopedStudents,
        grades: scope.scopedGrades,
        sortStrategy: 'by-name',
        scopeLabel: scope.scopeLabel,
        period: periodKey
      });
      currentReport.scopeAverageCaption = scope.scopeAverageCaption;
      console.log(`\n${currentReport.title}`);
      printStudentsTable(currentReport.rows);
      printReportFooter(currentReport.stats, currentReport.scopeAverageCaption);
    } else if (n === 3) {
      const scope = await chooseScope(periodGrades);
      currentReport = buildReportView({
        students: scope.scopedStudents,
        grades: scope.scopedGrades,
        sortStrategy: 'by-average-desc',
        scopeLabel: scope.scopeLabel,
        period: periodKey
      });
      currentReport.scopeAverageCaption = scope.scopeAverageCaption;
      console.log(`\n${currentReport.title}`);
      printStudentsTable(currentReport.rows);
      printReportFooter(currentReport.stats, currentReport.scopeAverageCaption);
    } else if (n === 4) {
      const subject = String(await ask('Введіть назву предмета: ')).trim();
      if (!subject) {
        console.log('Назва предмета не може бути порожньою.');
        continue;
      }

      const scope = await chooseScope(periodGrades);
      currentReport = buildReportView({
        students: scope.scopedStudents,
        grades: scope.scopedGrades,
        sortStrategy: 'by-subject-average-desc',
        subject,
        scopeLabel: scope.scopeLabel,
        period: periodKey
      });
      currentReport.scopeAverageCaption = scope.scopeAverageCaption;
      console.log(`\n${currentReport.title}`);
      printStudentsTable(currentReport.rows);
      printReportFooter(currentReport.stats, currentReport.scopeAverageCaption);
    } else if (n === 5) {
      const scope = await chooseScope(periodGrades);
      currentReport = buildReportView({
        students: scope.scopedStudents,
        grades: scope.scopedGrades,
        sortStrategy: 'by-attendance-desc',
        scopeLabel: scope.scopeLabel,
        period: periodKey
      });
      currentReport.scopeAverageCaption = scope.scopeAverageCaption;
      console.log(`\n${currentReport.title}`);
      printStudentsTable(currentReport.rows);
      printReportFooter(currentReport.stats, currentReport.scopeAverageCaption);
    } else if (n === 6) {
      if (!currentReport) {
        console.log('Спочатку сформуйте звіт (1-5).');
        continue;
      }
      const formatAnswer = String(await ask('Формат (txt/html) [txt]: ')).trim();
      const format = formatAnswer ? normalizeFormat(formatAnswer) : 'txt';
      try {
        const filePath = await saveReportToFile({
          title: currentReport.title,
          rows: currentReport.rows,
          stats: currentReport.stats,
          format,
          scopeAverageCaption: currentReport.scopeAverageCaption
        });
        console.log(chalk.green(`Звіт збережено у файл: ${filePath}`));
        await log('success', `Saved report: ${filePath}`);
      } catch (e) {
        await log('error', `Save report failed: ${e && e.message ? e.message : e}`);
        console.error(chalk.red('Помилка збереження звіту.'));
      }
    } else {
      console.log('Невірний вибір. Спробуйте ще раз.');
    }
  }

  rl.close();
}

async function main() {
  const args = parseArgs(process.argv);
  const top = parseTopArg(args);
  const reportFormat = args.format ? normalizeFormat(args.format) : null;
  const period = normalizePeriod(args.period || 'all');

  const dataFile = path.join(process.cwd(), 'data', 'grades.json');
  let students;
  let grades;
  try {
    ({ students, grades } = await loadData(dataFile));
    console.log(chalk.green('Базу даних прочитано успішно.'));
    await log('success', 'Успішно прочитано базу даних');
  } catch (e) {
    await log('error', `Load data failed: ${e && e.message ? e.message : String(e)}`);
    if (e && e.code === 'DATA_READ_ERROR') {
      console.error(chalk.red('Помилка читання бази даних'));
    } else {
      console.error(chalk.red('Помилка валідації бази даних'));
    }
    process.exitCode = 1;
    return;
  }

  const gradesPeriod = filterGradesByPeriod(grades, period);

  if (args.action === undefined) {
    await showMenu(students, grades);
    return;
  }

  const groupName = args.group ? String(args.group).trim() : null;
  const { scopedStudents, scopedGrades, scopeLabel, scopeAverageCaption } = applyGroupFilter(
    students,
    gradesPeriod,
    groupName
  );

  const action = args.action;

  if (action === 'report') {
    const sortStrategy = args.sort || 'by-name';
    const subject = String(args.subject || '').trim();

    if (sortStrategy === 'by-subject-average-desc' && !subject) {
      console.error('Для сортування по предмету потрібно передати --subject "<назва предмету>".');
      process.exitCode = 1;
      return;
    }

    const view = buildReportView({
      students: scopedStudents,
      grades: scopedGrades,
      sortStrategy,
      subject: sortStrategy === 'by-subject-average-desc' ? subject : undefined,
      scopeLabel,
      period
    });

    const finalRows = top ? view.rows.slice(0, top) : view.rows;
    console.log(`\n${view.title}`);
    if (top) console.log(`Показано перші ${top} результат(ів).`);
    printStudentsTable(finalRows);
    const statsFinal = buildReportStats(finalRows);
    printReportFooter(statsFinal, scopeAverageCaption);

    if (reportFormat) {
      const filePath = await saveReportToFile({
        title: view.title,
        rows: finalRows,
        stats: statsFinal,
        format: reportFormat,
        scopeAverageCaption
      });
      await log('success', `Saved report: ${filePath}`);
      console.log(chalk.green(`Звіт збережено у файл: ${filePath}`));
    }
  } else if (action === 'find') {
    const query = String(args.query || '').trim();
    if (!query) {
      console.error('Для дії find потрібно передати --query "<частина ПІБ>".');
      process.exitCode = 1;
      return;
    }

    const matches = findStudentsByName(buildStudentReport(scopedStudents, scopedGrades), query);
    let sorted = matches;

    const sortStrategy = args.sort;
    if (sortStrategy === 'by-subject-average-desc') {
      const subject = String(args.subject || '').trim();
      if (!subject) {
        console.error('Для сортування по предмету потрібно передати --subject "<назва предмету>".');
        process.exitCode = 1;
        return;
      }

      const subjectReport = buildStudentSubjectAverage(matches, scopedGrades, subject);
      sorted = sortStudents(subjectReport, 'by-subject-average-desc');
    } else if (sortStrategy) {
      sorted = sortStudents(matches, sortStrategy);
    }

    const finalList = top ? sorted.slice(0, top) : sorted;
    console.log(`\nРезультати пошуку за "${query}":`);
    if (finalList.length === 0) console.log('Нічого не знайдено.');
    else {
      if (top) console.log(`Показано перші ${top} результат(ів).`);
      printStudentsTable(finalList);
      const statsFinal = buildReportStats(finalList);
      printReportFooter(statsFinal, scopeAverageCaption);

      if (reportFormat) {
        const title = `Звіт за пошуком: ${query} — ${scopeLabel}`;
        const filePath = await saveReportToFile({
          title,
          rows: finalList,
          stats: statsFinal,
          format: reportFormat,
          scopeAverageCaption
        });
        await log('success', `Saved report: ${filePath}`);
        console.log(chalk.green(`Звіт збережено у файл: ${filePath}`));
      }
    }
  } else if (action === 'avg') {
    const sortStrategy = args.sort || 'by-average-desc';
    if (sortStrategy === 'by-subject-average-desc') {
      const subject = String(args.subject || '').trim();
      if (!subject) {
        console.error('Для сортування по предмету потрібно передати --subject "<назва предмету>".');
        process.exitCode = 1;
        return;
      }

      const view = buildReportView({
        students: scopedStudents,
        grades: scopedGrades,
        sortStrategy,
        subject,
        scopeLabel,
        period
      });
      const finalRows = top ? view.rows.slice(0, top) : view.rows;
      console.log(`\n${view.title}`);
      if (top) console.log(`Показано перші ${top} результат(ів).`);
      printStudentsTable(finalRows);
      const statsFinal = buildReportStats(finalRows);
      printReportFooter(statsFinal, scopeAverageCaption);

      if (reportFormat) {
        const filePath = await saveReportToFile({
          title: view.title,
          rows: finalRows,
          stats: statsFinal,
          format: reportFormat,
          scopeAverageCaption
        });
        await log('success', `Saved report: ${filePath}`);
        console.log(chalk.green(`Звіт збережено у файл: ${filePath}`));
      }
    } else {
      const reportRows = buildStudentAverage(scopedStudents, scopedGrades);
      const sortedRows = sortStudents(reportRows, sortStrategy);
      const stats = buildReportStats(sortedRows);
      const finalRows = top ? sortedRows.slice(0, top) : sortedRows;

      console.log(`\nСередній бал по студентах (сортування: ${sortStrategy})`);
      if (top) console.log(`Показано перші ${top} результат(ів).`);
      printStudentsTable(finalRows);
      const statsFinal = buildReportStats(finalRows);
      printReportFooter(statsFinal, scopeAverageCaption);

      if (reportFormat) {
        const title = `Середній бал по студентах (сортування: ${sortStrategy}) — ${scopeLabel}`;
        const filePath = await saveReportToFile({
          title,
          rows: finalRows,
          stats: statsFinal,
          format: reportFormat,
          scopeAverageCaption
        });
        await log('success', `Saved report: ${filePath}`);
        console.log(chalk.green(`Звіт збережено у файл: ${filePath}`));
      }
    }
  } else {
    console.error('Невідома дія. Використовуйте --action report, --action find або --action avg.');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
