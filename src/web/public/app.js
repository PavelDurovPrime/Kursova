(function () {
  const FETCH_TIMEOUT_MS = 20000;
  const $ = (sel) => document.querySelector(sel);

  const periodSelect = $('#period');
  const groupSelect = $('#group');
  const sortSelect = $('#sort');
  const subjectField = $('#subjectField');
  const subjectSelect = $('#subject');
  const queryInput = $('#query');
  const form = $('#filterForm');
  const loading = $('#loading');
  const errorBanner = $('#errorBanner');
  const table = $('#dataTable');
  const tableBody = $('#tableBody');
  const emptyState = $('#emptyState');
  const reportTitle = $('#reportTitle');
  const summaryPanel = $('#summaryPanel');
  const statCards = $('#statCards');
  const metaCount = $('#metaCount');
  const metaGrades = $('#metaGrades');
  const exportPdf = $('#exportPdf');
  const reportCountLine = $('#reportCountLine');
  const reportCountNum = $('#reportCountNum');
  const reportCountWord = $('#reportCountWord');
  const btnReset = $('#btnReset');
  const modal = $('#modal');
  const modalBackdrop = $('#modalBackdrop');
  const modalTitle = $('#modalTitle');
  const modalSub = $('#modalSub');
  const modalGradesBody = $('#modalGradesBody');
  const modalAvg = $('#modalAvg');
  const modalClose = $('#modalClose');
  const subjectDetails = $('#subjectDetails');
  const subjectDetailsTitle = $('#subjectDetailsTitle');
  const subjectDetailsBody = $('#subjectDetailsBody');
  const btnBackToGrades = $('#btnBackToGrades');

  const skeletonLoading = $('#skeletonLoading');
  const chartContainer = $('#chartContainer');
  const trendChartCanvas = $('#trendChart');

  let selectedRowId = null;
  let currentStudentGrades = [];
  let trendChartInstance = null;
  let previousRankings = {};
  let groupAverages = {};

  function fetchWithTimeout(url, options = {}) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(id));
  }

  function publicBasePath() {
    const m = document.querySelector('meta[name="gradelogic-public-base"]');
    return String(m?.getAttribute('content') ?? '')
      .trim()
      .replace(/\/$/, '');
  }

  function apiUrl(path) {
    const base = publicBasePath();
    const p = path.startsWith('/') ? path : `/${path}`;
    return base ? `${base}/api${p}` : `/api${p}`;
  }

  function escapeHtml(value) {
    const d = document.createElement('div');
    d.textContent = value;
    return d.innerHTML;
  }

  function showSubjectField() {
    subjectField.hidden = sortSelect.value !== 'by-subject-average-desc';
  }

  function buildQuery() {
    const params = new URLSearchParams();
    if (periodSelect.value) params.set('period', periodSelect.value);
    if (groupSelect.value) params.set('group', groupSelect.value);
    params.set('sort', sortSelect.value);
    if (sortSelect.value === 'by-subject-average-desc' && subjectSelect.value) {
      params.set('subject', subjectSelect.value);
    }
    const query = queryInput.value.trim();
    if (query) params.set('query', query);
    return params.toString();
  }

  function updateExportLinks() {
    exportPdf.href = `${apiUrl('/export')}?format=pdf&${buildQuery()}`;
  }

  function ukrainianCountWord(n) {
    const abs = Math.abs(n) % 100;
    const d = abs % 10;
    if (abs > 10 && abs < 20) return 'студентів';
    if (d > 1 && d < 5) return 'студенти';
    if (d === 1) return 'студент';
    return 'студентів';
  }

  function updateReportCount(n) {
    const count = Number(n) || 0;
    reportCountNum.textContent = String(count);
    reportCountWord.textContent = ukrainianCountWord(count);
    reportCountLine.hidden = false;
  }

  function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  function getTierBadge(average) {
    if (!Number.isFinite(average)) return '';
    if (average >= 95) {
      return '<span class="tier-badge tier-diamond" title="Diamond Tier">💎 Diamond</span>';
    } else if (average >= 90) {
      return '<span class="tier-badge tier-platinum" title="Platinum Tier">🌟 Platinum</span>';
    } else if (average >= 75) {
      return '<span class="tier-badge tier-gold" title="Gold Tier">⭐ Gold</span>';
    }
    return '';
  }

  function getProgressClass(score) {
    if (score >= 90) return 'progress-excellent';
    if (score >= 75) return 'progress-good';
    if (score >= 60) return 'progress-average';
    return 'progress-poor';
  }

  function getRankChangeIndicator(studentId, currentRank) {
    const previousRank = previousRankings[studentId];
    if (previousRank === undefined) return '';
    
    const change = previousRank - currentRank;
    if (change > 0) {
      return `<span class="rank-indicator rank-up" title="+${change} ↑">↑</span>`;
    } else if (change < 0) {
      return `<span class="rank-indicator rank-down" title="${change} ↓">↓</span>`;
    }
    return '';
  }

  function formatAvgCell(formatted, raw) {
    const span = document.createElement('span');
    span.className = 'avg-badge';
    span.textContent = formatted ?? '—';
    if (Number.isFinite(raw)) {
      if (raw < 60) span.classList.add('avg-critical');
      else if (raw >= 60 && raw <= 75) span.classList.add('avg-warning');
      else if (raw > 90) span.classList.add('avg-excellent');
    }
    return span;
  }

  function formatAttCell(formatted, raw, attended, total) {
    const span = document.createElement('span');
    span.className = 'att-badge';
    const pct = formatted ?? '—';
    const detail = Number.isFinite(attended) && Number.isFinite(total) ? ` (${attended}/${total})` : '';
    span.textContent = `${pct}${detail}`;
    if (Number.isFinite(raw) && raw < 75) span.classList.add('att-weak');
    return span;
  }

  function renderStats(data) {
    statCards.innerHTML = '';
    const stats = data.stats || {};
    const cards = [
      {
        label: 'Найкращий у звіті',
        value: stats.bestStudent
          ? `${stats.bestStudent.fullName} — ${stats.bestStudent.averageFormatted ?? '—'}`
          : '—'
      },
      {
        label: data.scopeAverageCaption || 'Середній по вибірці',
        value: stats.groupAverageFormatted ?? '—'
      }
    ];

    for (const card of cards) {
      const el = document.createElement('div');
      el.className = 'stat-card';
      el.innerHTML = `<dt>${escapeHtml(card.label)}</dt><dd>${escapeHtml(card.value)}</dd>`;
      statCards.appendChild(el);
    }

    summaryPanel.hidden = false;
  }

  function hasFireStreak(grades) {
    if (!grades || !Array.isArray(grades)) return false;
    const highGrades = grades.filter(g => (parseFloat(g.value) || 0) >= 95);
    return highGrades.length >= 5;
  }

  function renderTable(rows, allRows = []) {
    tableBody.innerHTML = '';
    if (!rows.length) {
      table.hidden = true;
      emptyState.hidden = false;
      reportCountLine.hidden = true;
      return;
    }

    emptyState.hidden = true;
    table.hidden = false;

    const currentRankings = {};
    const groupRankings = {};
    rows.forEach(row => {
      if (!groupRankings[row.group]) groupRankings[row.group] = [];
      groupRankings[row.group].push(row);
    });
    Object.keys(groupRankings).forEach(group => {
      groupRankings[group].sort((a, b) => (parseFloat(b.average) || 0) - (parseFloat(a.average) || 0));
    });

    rows.forEach((row, index) => {
      currentRankings[row.id] = index + 1;
      const groupRank = groupRankings[row.group].findIndex(r => r.id === row.id) + 1;
      const tr = document.createElement('tr');
      tr.tabIndex = 0;
      tr.dataset.id = String(row.id);
      tr.dataset.groupRank = String(groupRank);
      if (selectedRowId === row.id) tr.setAttribute('aria-selected', 'true');
      const tierBadge = getTierBadge(row.average);
      const rankIndicator = getRankChangeIndicator(row.id, index + 1);
      const fireStreak = hasFireStreak(row.grades) ? '<span class="fire-streak" title="5+ оцінок 95+">🔥<span class="fire-count">5</span></span>' : '';
      tr.innerHTML = `
        <td><span class="avatar">${getInitials(row.fullName)}</span></td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            ${escapeHtml(row.fullName)}${rankIndicator}${fireStreak}
            ${tierBadge}
          </div>
        </td>
        <td>${escapeHtml(row.group)}</td>
        <td class="num"></td>
        <td class="num"></td>
      `;

      const cells = tr.querySelectorAll('td');
      cells[3].appendChild(formatAvgCell(row.averageFormatted, row.average));
      cells[4].appendChild(formatAttCell(row.attendanceFormatted, row.attendancePercent, row.attendedLessons, row.totalLessons));

      tr.addEventListener('click', () => openStudentModal(row.id, groupRank));
      tr.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openStudentModal(row.id, groupRank);
        }
      });

      tableBody.appendChild(tr);
    });

    previousRankings = currentRankings;
  }

  async function loadMeta() {
    let res;
    try {
      res = await fetchWithTimeout(apiUrl('/meta'));
    } catch (e) {
      if (e.name === 'AbortError') {
        throw new Error('Час очікування сервера вичерпано. Перевірте, чи запущено API.');
      }
      throw e;
    }

    if (!res.ok) throw new Error('Не вдалося отримати метадані');
    const data = await res.json();

    metaCount.textContent = String(data.studentCount);
    metaGrades.textContent = String(data.gradeCount);

    groupAverages = data.groupAverages || {};

    if (Array.isArray(data.periods) && data.periods.length) {
      periodSelect.innerHTML = '';
      for (const period of data.periods) {
        const option = document.createElement('option');
        option.value = period.id;
        option.textContent = period.label;
        periodSelect.appendChild(option);
      }
    }

    groupSelect.innerHTML = '<option value="">Усі групи (весь потік)</option>';
    for (const group of data.groups || []) {
      const option = document.createElement('option');
      option.value = group;
      option.textContent = group;
      groupSelect.appendChild(option);
    }

    subjectSelect.innerHTML = '';
    for (const subject of data.subjects || []) {
      const option = document.createElement('option');
      option.value = subject;
      option.textContent = subject;
      subjectSelect.appendChild(option);
    }
  }

  async function loadReport() {
    errorBanner.hidden = true;
    skeletonLoading.hidden = false;
    loading.hidden = true;
    table.hidden = true;
    emptyState.hidden = true;

    try {
      const res = await fetchWithTimeout(`${apiUrl('/report')}?${buildQuery()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Помилка ${res.status}`);
      reportTitle.textContent = data.title || 'Звіт';
      updateReportCount((data.rows && data.rows.length) || data.shownCount || 0);
      renderStats(data);
      renderTable(data.rows || []);
      updateExportLinks();
    } catch (e) {
      errorBanner.textContent = e.name === 'AbortError' ? 'Час очікування сервера вичерпано.' : e.message || 'Невідома помилка';
      errorBanner.hidden = false;
      summaryPanel.hidden = true;
      reportCountLine.hidden = true;
    } finally {
      skeletonLoading.hidden = true;
    }
  }

  function buildLessonRows(gradeInfo) {
    const rows = [];
    const totalLessons = Number(gradeInfo.totalLessons) || 0;
    const attendedLessons = Math.max(0, Math.min(Number(gradeInfo.attendedLessons) || 0, totalLessons));
    const absences = Math.max(0, totalLessons - attendedLessons);
    const attendedScore = attendedLessons > 0 ? Math.round(Number(gradeInfo.value) || 0) : null;
    const startMonth = gradeInfo.semester === 1 ? 8 : 1;
    const startDate = new Date(2025, startMonth, 2);

    const missInterval = absences > 0 ? Math.floor(totalLessons / absences) : totalLessons + 1;

    for (let index = 0; index < totalLessons; index += 1) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index * 7);
      
      const isAbsent = absences > 0 && (index % missInterval === 0) && (rows.filter(r => !r.present).length < absences);
      
      rows.push({
        date: date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        score: isAbsent ? '—' : attendedScore,
        presence: isAbsent ? 'Відсутній' : 'Присутній',
        mark: isAbsent ? 'Н' : attendedScore,
        present: !isAbsent
      });
    }

    let currentAbsences = rows.filter(r => !r.present).length;
    if (currentAbsences < absences) {
      for (let i = rows.length - 1; i >= 0 && currentAbsences < absences; i--) {
        if (rows[i].present) {
          rows[i].score = '—';
          rows[i].presence = 'Відсутній';
          rows[i].mark = 'Н';
          rows[i].present = false;
          currentAbsences++;
        }
      }
    }

    return rows;
  }

  function showSubjectDetails(gradeInfo) {
    subjectDetailsTitle.textContent = `${gradeInfo.subject} · ${gradeInfo.semester} семестр`;
    subjectDetailsBody.innerHTML = '';

    const oldBanner = subjectDetails.querySelector('.missed-info-banner');
    if (oldBanner) oldBanner.remove();

    const oldHeatmap = subjectDetails.querySelector('.attendance-heatmap');
    if (oldHeatmap) oldHeatmap.remove();

    const lessonRows = buildLessonRows(gradeInfo);
    const missedDates = lessonRows.filter(l => !l.present).map(l => l.date);
    
    const heatmapContainer = document.createElement('div');
    heatmapContainer.className = 'attendance-heatmap';
    
    const presentCount = lessonRows.filter(l => l.present).length;
    const absentCount = lessonRows.filter(l => !l.present).length;
    const score = gradeInfo.value || 0;
    
    const statsHeader = document.createElement('div');
    statsHeader.className = 'heatmap-stats';
    statsHeader.innerHTML = `
      <div class="heatmap-stat">
        <span class="heatmap-stat-value">${presentCount}</span>
        <span class="heatmap-stat-label">Відвідано</span>
      </div>
      <div class="heatmap-stat">
        <span class="heatmap-stat-value heatmap-stat-value-absent">${absentCount}</span>
        <span class="heatmap-stat-label">Пропущено</span>
      </div>
      <div class="heatmap-stat">
        <span class="heatmap-stat-value">${score}</span>
        <span class="heatmap-stat-label">Оцінка</span>
      </div>
    `;
    heatmapContainer.appendChild(statsHeader);
    
    const monthLabels = document.createElement('div');
    monthLabels.className = 'heatmap-months';
    
    const monthGroups = {};
    lessonRows.forEach(lesson => {
      const date = new Date(lesson.date.split('.').reverse().join('-'));
      const monthKey = date.toLocaleDateString('uk-UA', { month: 'short' });
      if (!monthGroups[monthKey]) {
        monthGroups[monthKey] = [];
      }
      monthGroups[monthKey].push(lesson);
    });
    
    Object.keys(monthGroups).forEach(month => {
      const monthLabel = document.createElement('span');
      monthLabel.className = 'heatmap-month-label';
      monthLabel.textContent = month;
      monthLabels.appendChild(monthLabel);
    });
    heatmapContainer.appendChild(monthLabels);
    
    const gridContainer = document.createElement('div');
    gridContainer.className = 'heatmap-grid';
    
    const dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
    
    lessonRows.forEach((lesson, index) => {
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';
      
      if (!lesson.present) {
        cell.classList.add('heatmap-cell-absent');
        cell.title = `${lesson.date}: Відсутній (Н)`;
      } else {
        const intensity = Math.min(4, Math.max(1, Math.ceil(score / 25)));
        cell.classList.add(`heatmap-cell-level-${intensity}`);
        cell.title = `${lesson.date}: Присутній (${lesson.score} балів)`;
      }
      
      const date = new Date(lesson.date.split('.').reverse().join('-'));
      cell.dataset.weekday = date.getDay() || 7;
      
      gridContainer.appendChild(cell);
    });
    
    heatmapContainer.appendChild(gridContainer);
    
    const legend = document.createElement('div');
    legend.className = 'heatmap-legend';
    legend.innerHTML = `
      <span class="heatmap-legend-label">Менше</span>
      <div class="heatmap-legend-cells">
        <div class="heatmap-cell heatmap-cell-level-0"></div>
        <div class="heatmap-cell heatmap-cell-level-1"></div>
        <div class="heatmap-cell heatmap-cell-level-2"></div>
        <div class="heatmap-cell heatmap-cell-level-3"></div>
        <div class="heatmap-cell heatmap-cell-level-4"></div>
      </div>
      <span class="heatmap-legend-label">Більше</span>
    `;
    heatmapContainer.appendChild(legend);

    subjectDetails.insertBefore(heatmapContainer, subjectDetails.querySelector('.lessons-table'));

    if (missedDates.length > 0) {
      const missedInfo = document.createElement('div');
      missedInfo.className = 'missed-info-banner';
      missedInfo.innerHTML = `<strong>Пропущені заняття:</strong> ${missedDates.join(', ')}`;
      subjectDetails.insertBefore(missedInfo, subjectDetails.querySelector('.lessons-table'));
    }

    subjectDetails.hidden = false;
  }

  function getComparisonIndicator(grade, groupName) {
    const groupAvg = groupAverages[groupName];
    if (!Number.isFinite(groupAvg) || !Number.isFinite(grade)) return '';
    
    const diff = (grade - groupAvg).toFixed(1);
    if (diff > 0) {
      return `<span class="comparison-indicator comparison-above">+${diff} вище групи</span>`;
    } else if (diff < 0) {
      return `<span class="comparison-indicator comparison-below">${diff} нижче групи</span>`;
    }
    return `<span class="comparison-indicator comparison-above">= середній групи</span>`;
  }

  function renderModalGrades(grades, studentGroup) {
    modalGradesBody.innerHTML = '';
    if (!grades.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="5">Оцінок за обраний період немає</td>';
      modalGradesBody.appendChild(tr);
      return;
    }

    for (const grade of grades) {
      const tr = document.createElement('tr');
      tr.className = 'clickable';
      const attendance = `${grade.attendedLessons} з ${grade.totalLessons}`;
      const misses = Number.isFinite(grade.absences) && grade.absences > 0 ? ` (пропусків: ${grade.absences})` : '';
      const comparison = getComparisonIndicator(grade.value, studentGroup);
      const progressClass = getProgressClass(grade.value);
      const progressPercent = Math.min(100, Math.max(0, grade.value || 0));
      
      tr.innerHTML = `
        <td>${escapeHtml(grade.subject)} ${comparison}</td>
        <td class="num">${grade.semester ?? '—'}</td>
        <td class="num">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>${grade.value}</span>
            <div class="progress-bar" style="width: 60px;">
              <div class="progress-fill ${progressClass}" style="width: ${progressPercent}%"></div>
            </div>
          </div>
        </td>
        <td class="modal-att">${escapeHtml(attendance)}${escapeHtml(misses)}</td>
      `;
      tr.addEventListener('click', () => showSubjectDetails(grade));
      modalGradesBody.appendChild(tr);
    }
  }

  function renderTrendChart(grades) {
    if (!trendChartCanvas || !window.Chart) return;
    
    // Destroy previous chart
    if (trendChartInstance) {
      trendChartInstance.destroy();
      trendChartInstance = null;
    }

    if (!grades || !Array.isArray(grades) || grades.length === 0) {
      chartContainer.hidden = true;
      return;
    }

    const validGrades = grades.filter(g => g && g.subject && g.value != null);
    if (validGrades.length === 0) {
      chartContainer.hidden = true;
      return;
    }

    chartContainer.hidden = false;

    const subjectScores = {};
    validGrades.forEach(g => {
      if (!subjectScores[g.subject]) {
        subjectScores[g.subject] = { sum: 0, count: 0 };
      }
      const val = parseFloat(g.value);
      if (!isNaN(val)) {
        subjectScores[g.subject].sum += val;
        subjectScores[g.subject].count += 1;
      }
    });

    const labels = Object.keys(subjectScores).filter(s => subjectScores[s].count > 0);
    const data = labels.map(subject => {
      const s = subjectScores[subject];
      return Math.round(s.sum / s.count);
    });

    if (labels.length === 0) {
      chartContainer.hidden = true;
      return;
    }

    const sortedData = labels.map((label, i) => ({ label, score: data[i] }))
      .sort((a, b) => b.score - a.score);
    const sortedLabels = sortedData.map(d => d.label);
    const sortedScores = sortedData.map(d => d.score);
    
    setTimeout(() => {
      const container = chartContainer;
      const canvas = trendChartCanvas;
      
      canvas.width = container.clientWidth || 400;
      canvas.height = 250;
      canvas.style.width = '100%';
      canvas.style.height = '250px';
      
      const ctx = canvas.getContext('2d');
      
      trendChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: sortedLabels,
          datasets: [{
            label: 'Бал',
            data: sortedScores,
            backgroundColor: sortedScores.map((score) => {
              const g = ctx.createLinearGradient(0, 0, 300, 0);
              const alpha = 0.5 + (score / 200);
              g.addColorStop(0, `rgba(15, 23, 42, ${alpha})`);
              g.addColorStop(1, `rgba(15, 23, 42, ${alpha * 0.4})`);
              return g;
            }),
            borderColor: '#0f172a',
            borderWidth: 1,
            borderRadius: 6,
            borderSkipped: false,
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 600,
            easing: 'easeOutQuart'
          },
          layout: {
            padding: { left: 10, right: 20, top: 10, bottom: 10 }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0f172a',
              titleColor: '#ffffff',
              bodyColor: '#ffffff',
              borderColor: '#334155',
              borderWidth: 1,
              cornerRadius: 8,
              displayColors: false,
              callbacks: {
                title: (ctx) => ctx[0]?.label || '',
                label: (ctx) => `Бал: ${ctx.parsed?.x || 0}`
              }
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              max: 100,
              grid: { color: 'rgba(0, 0, 0, 0.05)' },
              ticks: { color: '#64748b', font: { size: 10 } }
            },
            y: {
              grid: { display: false },
              ticks: { 
                color: '#334155', 
                font: { size: 11, weight: '600' }
              }
            }
          }
        }
      });
    }, 200);
  }

  async function openStudentModal(id, groupRank) {
    selectedRowId = id;
    document.querySelectorAll('.data-table tbody tr').forEach((tr) => {
      tr.toggleAttribute('aria-selected', Number(tr.dataset.id) === id);
    });

    modalTitle.textContent = 'Завантаження…';
    modalSub.textContent = '';
    modalGradesBody.innerHTML = '';
    modalAvg.textContent = '';
    subjectDetails.hidden = true;
    chartContainer.hidden = true;
    modal.hidden = false;
    modalBackdrop.hidden = false;

    // Destroy previous chart
    if (trendChartInstance) {
      trendChartInstance.destroy();
      trendChartInstance = null;
    }

    try {
      const periodQuery = periodSelect.value ? `?period=${encodeURIComponent(periodSelect.value)}` : '';
      const res = await fetchWithTimeout(`${apiUrl(`/student/${id}/grades`)}${periodQuery}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Помилка завантаження студента');

      modalTitle.textContent = data.student.fullName;
      modalSub.innerHTML = `Група ${data.student.group} <span style="color: var(--text-muted); margin-left: 8px;">Ранг у групі: <strong style="color: var(--accent);">#${groupRank || '—'}</strong></span>`;
      currentStudentGrades = data.items || data.grades || [];
      renderModalGrades(currentStudentGrades, data.student.group);
      renderTrendChart(currentStudentGrades);

      if (sortSelect.value === 'by-subject-average-desc' && subjectSelect.value) {
        const gradeToShow = currentStudentGrades.find(g => g.subject === subjectSelect.value);
        if (gradeToShow) {
          showSubjectDetails(gradeToShow);
        }
      }

      const summary = data.summary || {};
      modalAvg.textContent =
        `Середній бал: ${summary.averageFormatted ?? '—'} · ` +
        `Усього відвідуваність: ${summary.attendanceFormatted ?? '—'} ` +
        `(${summary.attendedLessons ?? '—'} з ${summary.totalLessons ?? '—'} занять)`;
    } catch (e) {
      modalTitle.textContent = 'Помилка';
      modalSub.textContent = e.name === 'AbortError' ? 'Час очікування сервера вичерпано.' : e.message || '';
    }
  }

  function closeModal() {
    modal.hidden = true;
    modalBackdrop.hidden = true;
    selectedRowId = null;
    subjectDetails.hidden = true;
    chartContainer.hidden = true;
    if (trendChartInstance) {
      trendChartInstance.destroy();
      trendChartInstance = null;
    }
    document.querySelectorAll('.data-table tbody tr').forEach((tr) => tr.removeAttribute('aria-selected'));
  }

  sortSelect.addEventListener('change', showSubjectField);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (sortSelect.value === 'by-subject-average-desc' && !subjectSelect.value) {
      errorBanner.textContent = 'Оберіть предмет для цього виду сортування.';
      errorBanner.hidden = false;
      return;
    }
    loadReport();
  });

  btnReset.addEventListener('click', () => {
    periodSelect.value = 'all';
    groupSelect.value = '';
    sortSelect.value = 'by-average-desc';
    queryInput.value = '';
    showSubjectField();
    if (subjectSelect.options[0]) subjectSelect.selectedIndex = 0;
    loadReport();
  });

  if (modalClose) {
    modalClose.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeModal();
    });
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', closeModal);
  }

  if (btnBackToGrades) {
    btnBackToGrades.addEventListener('click', () => {
      subjectDetails.hidden = true;
      modalGradesBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) {
      closeModal();
      event.preventDefault();
    }
  });

  modal.hidden = true;
  modalBackdrop.hidden = true;
  loading.hidden = true;
  chartContainer.hidden = true;

  let debounceTimer = null;
  const DEBOUNCE_DELAY = 300;

  function debouncedLoadReport() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (sortSelect.value === 'by-subject-average-desc' && !subjectSelect.value) {
        errorBanner.textContent = 'Оберіть предмет для цього виду сортування.';
        errorBanner.hidden = false;
        return;
      }
      errorBanner.hidden = true;
      loadReport();
    }, DEBOUNCE_DELAY);
  }

  periodSelect.addEventListener('change', debouncedLoadReport);
  groupSelect.addEventListener('change', debouncedLoadReport);
  sortSelect.addEventListener('change', () => {
    showSubjectField();
    debouncedLoadReport();
  });
  subjectSelect.addEventListener('change', debouncedLoadReport);
  queryInput.addEventListener('input', debouncedLoadReport);

  showSubjectField();
  loadMeta()
    .then(() => loadReport())
    .catch((e) => {
      errorBanner.textContent = e.message || 'Помилка старту';
      errorBanner.hidden = false;
      loading.hidden = true;
    });
})();
