(function () {
  const $ = (sel) => document.querySelector(sel);
  const ratingList = $('#ratingList');
  const metaGroups = $('#metaGroups');
  const metaStudents = $('#metaStudents');
  const modal = $('#modal');
  const modalBackdrop = $('#modalBackdrop');
  const modalClose = $('#modalClose');
  const modalTitle = $('#modalTitle');
  const groupAvg = $('#groupAvg');
  const groupCount = $('#groupCount');
  const bestStudentsList = $('#bestStudentsList');
  const groupAttendance = $('#groupAttendance');
  const groupExcellent = $('#groupExcellent');
  const avgChartCanvas = $('#avgChart');
  const attendanceChartCanvas = $('#attendanceChart');
  const excellentChartCanvas = $('#excellentChart');
  const studentsChartCanvas = $('#studentsChart');
  const topAttendanceCard = $('#topAttendance');
  const mostImprovedCard = $('#mostImproved');

  let avgChartInstance = null;
  let attendanceChartInstance = null;
  let excellentChartInstance = null;
  let studentsChartInstance = null;

  function* colorCycleGenerator(colors) {
    let index = 0;
    while (true) {
      yield colors[index % colors.length];
      index++;
    }
  }

  const feedColors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];
  const colorGenerator = colorCycleGenerator(feedColors);

  class EventBus {
    constructor() {
      this.events = new Map();
    }

    subscribe(event, callback) {
      if (!this.events.has(event)) {
        this.events.set(event, []);
      }
      this.events.get(event).push(callback);
      return () => this.unsubscribe(event, callback);
    }

    publish(event, data) {
      const callbacks = this.events.get(event) || [];
      callbacks.forEach((cb) => cb(data));
    }

    unsubscribe(event, callback) {
      const callbacks = this.events.get(event) || [];
      const index = callbacks.indexOf(callback);
      if (index > -1) callbacks.splice(index, 1);
    }
  }

  const appEvents = new EventBus();

  class PriorityQueue {
    constructor(compareFn = (a, b) => a.priority - b.priority) {
      this.items = [];
      this.compare = compareFn;
    }

    enqueue(item, priority) {
      this.items.push({ item, priority });
      this.items.sort((a, b) => this.compare(a, b));
    }

    dequeue() {
      return this.items.shift()?.item;
    }

    peek() {
      return this.items[0]?.item;
    }

    getTopN(n) {
      return this.items.slice(0, n).map((i) => i.item);
    }

    getBottomN(n) {
      return this.items
        .slice(-n)
        .reverse()
        .map((i) => i.item);
    }

    size() {
      return this.items.length;
    }
  }

  class LiveFeedManager {
    constructor(containerId) {
      this.container = $(`#${containerId}`);
      this.feedItems = [];
      this.maxItems = 5;
      this.rotationInterval = null;
    }

    addItem(title, meta, icon = '📊') {
      const color = colorGenerator.next().value;
      const item = {
        id: Date.now(),
        title,
        meta,
        icon,
        color,
        time: new Date().toLocaleTimeString('uk-UA', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      this.feedItems.unshift(item);
      if (this.feedItems.length > this.maxItems) {
        this.feedItems.pop();
      }

      this.render();
      appEvents.publish('feed:updated', item);
    }

    render() {
      if (!this.container) return;

      if (this.feedItems.length === 0) {
        this.container.innerHTML =
          '<div class="live-feed-empty">Очікування оновлень...</div>';
        return;
      }

      this.container.innerHTML = this.feedItems
        .map(
          (item) => `
        <div class="live-feed-item" style="border-left: 3px solid ${item.color}">
          <div class="live-feed-icon" style="background: ${item.color}20; color: ${item.color}">
            ${item.icon}
          </div>
          <div class="live-feed-content">
            <div class="live-feed-title">${item.title}</div>
            <div class="live-feed-meta">${item.meta}</div>
          </div>
          <div class="live-feed-time">${item.time}</div>
        </div>
      `,
        )
        .join('');
    }

    startMockUpdates() {
      const updates = [
        {
          title: 'Нова оцінка додана',
          meta: 'Студент: Іваненко І.І.',
          icon: '📝',
        },
        { title: 'Імпорт завершено', meta: 'Додано 15 записів', icon: '📥' },
        {
          title: 'Оновлення рейтингу',
          meta: 'Група КН-21 змінила позицію',
          icon: '📈',
        },
        {
          title: 'Експорт виконано',
          meta: 'Файл: report_2024.html',
          icon: '📤',
        },
        { title: 'Синхронізація', meta: 'Дані оновлено', icon: '🔄' },
      ];

      let index = 0;
      this.rotationInterval = setInterval(() => {
        const update = updates[index % updates.length];
        this.addItem(update.title, update.meta, update.icon);
        index++;
      }, 8000);
    }

    stop() {
      if (this.rotationInterval) {
        clearInterval(this.rotationInterval);
      }
    }
  }

  class ExportManager {
    constructor() {
      this.panel = $('#exportPanel');
      this.progressBar = $('#exportProgressBar');
      this.progressText = $('#exportProgressText');
      this.cancelBtn = $('#cancelExport');
      this.abortController = null;
    }

    async startExport() {
      if (!this.panel) return;

      this.panel.hidden = false;
      this.cancelBtn.hidden = false;
      this.abortController = new AbortController();

      const total = 100;

      try {
        for (let i = 0; i <= total; i += 5) {
          if (this.abortController.signal.aborted) {
            throw new Error('Export cancelled');
          }

          await this.delay(100);
          this.updateProgress(i);
        }

        this.completeExport();
      } catch (error) {
        if (error.message === 'Export cancelled') {
          this.updateProgress(0);
          this.panel.hidden = true;
        }
      }
    }

    updateProgress(percent) {
      if (this.progressBar) {
        this.progressBar.style.setProperty('--progress', `${percent}%`);
      }
      if (this.progressText) {
        this.progressText.textContent = `${percent}%`;
      }
    }

    completeExport() {
      this.updateProgress(100);
      this.cancelBtn.hidden = true;
      setTimeout(() => {
        this.panel.hidden = true;
        this.updateProgress(0);
        appEvents.publish('export:complete', { timestamp: Date.now() });
      }, 1500);
    }

    cancel() {
      if (this.abortController) {
        this.abortController.abort();
      }
    }

    delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
  }

  class QuickStatsManager {
    constructor() {
      this.topList = $('#topGroupsList');
      this.bottomList = $('#bottomGroupsList');
    }

    render(groups) {
      if (!groups || groups.length === 0) return;

      const queue = new PriorityQueue((a, b) => b.priority - a.priority);

      groups.forEach((group) => {
        const avg = parseFloat(group.averageGrade) || 0;
        queue.enqueue(group, avg);
      });

      const top3 = queue.getTopN(3);
      const bottom3 = queue.getBottomN(3);

      if (this.topList) {
        this.topList.innerHTML = top3
          .map(
            (g, i) => `
          <div class="quick-stat-item">
            <span class="quick-stat-name">${i + 1}. ${g.groupName}</span>
            <span class="quick-stat-value">${g.averageGradeFormatted || g.averageGrade}</span>
          </div>
        `,
          )
          .join('');
      }

      if (this.bottomList) {
        this.bottomList.innerHTML = bottom3
          .map(
            (g, i) => `
          <div class="quick-stat-item">
            <span class="quick-stat-name">${i + 1}. ${g.groupName}</span>
            <span class="quick-stat-value">${g.averageGradeFormatted || g.averageGrade}</span>
          </div>
        `,
          )
          .join('');
      }
    }
  }

  const liveFeed = new LiveFeedManager('liveFeed');
  const exportManager = new ExportManager();
  const quickStats = new QuickStatsManager();

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

  function getMedal(index) {
    if (index === 0) {
      return '<span class="crown-icon" title="1 місце">👑</span>';
    }
    if (index === 1) {
      return '<span class="crown-icon" title="2 місце">🥈</span>';
    }
    if (index === 2) {
      return '<span class="crown-icon" title="3 місце">🥉</span>';
    }
    return `<span class="rank-num">${index + 1}</span>`;
  }

  function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  function destroyCharts() {
    if (avgChartInstance) {
      avgChartInstance.destroy();
      avgChartInstance = null;
    }
    if (attendanceChartInstance) {
      attendanceChartInstance.destroy();
      attendanceChartInstance = null;
    }
    if (excellentChartInstance) {
      excellentChartInstance.destroy();
      excellentChartInstance = null;
    }
    if (studentsChartInstance) {
      studentsChartInstance.destroy();
      studentsChartInstance = null;
    }
  }

  function renderGroupsCharts(groups) {
    if (!window.Chart) return;
    destroyCharts();

    const maxGroups = Math.min(groups.length, 8);
    const sortedByAvg = groups
      .map((g) => ({ ...g, avgNum: parseFloat(g.averageGrade) || 0 }))
      .sort((a, b) => b.avgNum - a.avgNum);
    const topGroups = sortedByAvg.slice(0, maxGroups);

    const labels = topGroups.map((g) => g.groupName);
    const getRankColor = (index) => {
      if (index === 0) return '#ffd700';
      if (index === 1) return '#c0c0c0';
      if (index === 2) return '#cd7f32';
      return `hsl(${220 + index * 20}, 60%, ${50 + index * 5}%)`;
    };
    const colors = topGroups.map((_, i) => getRankColor(i));

    const avgScores = topGroups.map((g) => g.avgNum);
    const attendanceScores = topGroups.map(
      (g) => parseFloat(g.averageAttendance) || parseFloat(g.attendance) || 0,
    );
    const excellentScores = topGroups.map((g) => {
      const exc = g.topStudents
        ? g.topStudents.filter((s) => (parseFloat(s.average) || 0) >= 90).length
        : 0;
      return Math.round((exc / (g.studentCount || 1)) * 100);
    });
    const studentCounts = topGroups.map((g) => g.studentCount || 0);

    const chartConfig = (label, data, yMax = null, horizontal = false) => ({
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label,
            data,
            backgroundColor: colors.map((c) => `${c}80`),
            borderColor: colors,
            borderWidth: 2,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: horizontal ? 'y' : 'x',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.raw}${label.includes('%') ? '%' : ''}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: horizontal ? null : yMax,
            grid: { color: 'rgba(0, 0, 0, 0.05)' },
            ticks: {
              font: { size: maxGroups > 6 ? 10 : 12 },
            },
          },
          x: {
            beginAtZero: true,
            max: horizontal ? yMax : null,
            grid: { color: 'rgba(0, 0, 0, 0.05)' },
            ticks: {
              font: { size: maxGroups > 6 ? 10 : 12 },
            },
          },
        },
      },
    });

    const useHorizontal = maxGroups > 6;

    if (avgChartCanvas) {
      avgChartInstance = new window.Chart(
        avgChartCanvas.getContext('2d'),
        chartConfig('Середній бал', avgScores, 100, useHorizontal),
      );
    }
    if (attendanceChartCanvas) {
      attendanceChartInstance = new window.Chart(
        attendanceChartCanvas.getContext('2d'),
        chartConfig('Відвідуваність %', attendanceScores, 100, useHorizontal),
      );
    }
    if (excellentChartCanvas) {
      excellentChartInstance = new window.Chart(
        excellentChartCanvas.getContext('2d'),
        chartConfig('Відмінники %', excellentScores, 100, useHorizontal),
      );
    }
    if (studentsChartCanvas) {
      const maxStudents = Math.max(...studentCounts) || 1;
      studentsChartInstance = new window.Chart(
        studentsChartCanvas.getContext('2d'),
        chartConfig(
          'Кількість студентів',
          studentCounts,
          maxStudents,
          useHorizontal,
        ),
      );
    }
  }

  function renderNominations(groups) {
    if (!groups || groups.length === 0) return;
    const topAttGroup = groups.reduce((best, current) => {
      const bestAtt =
        parseFloat(best.averageAttendance) || parseFloat(best.attendance) || 0;
      const currAtt =
        parseFloat(current.averageAttendance) ||
        parseFloat(current.attendance) ||
        0;
      return currAtt > bestAtt ? current : best;
    }, groups[0]);
    if (topAttendanceCard && topAttGroup) {
      const attValue =
        parseFloat(topAttGroup.averageAttendance) ||
        parseFloat(topAttGroup.attendance) ||
        0;
      topAttendanceCard.querySelector('.nomination-group').textContent =
        topAttGroup.groupName;
      topAttendanceCard.querySelector('.nomination-value').textContent =
        `${attValue.toFixed(1)}% відвідуваність`;
    }
    const mostImproved = groups.reduce((best, current) => {
      const bestAvg = parseFloat(best.averageGrade) || 0;
      const currAvg = parseFloat(current.averageGrade) || 0;
      return currAvg > bestAvg ? current : best;
    }, groups[0]);
    if (mostImprovedCard && mostImproved) {
      mostImprovedCard.querySelector('.nomination-group').textContent =
        mostImproved.groupName;
      mostImprovedCard.querySelector('.nomination-value').textContent =
        `${mostImproved.averageGradeFormatted || mostImproved.averageGrade} середній бал`;
    }
  }

  async function loadMeta() {
    try {
      const res = await fetch(apiUrl('/meta'));
      if (!res.ok) return;
      const data = await res.json();
      metaGroups.textContent = data.groups.length;
      metaStudents.textContent = data.studentCount;
    } catch (e) {
      console.error('Failed to load meta', e);
    }
  }

  async function loadRating() {
    try {
      const res = await fetch(apiUrl('/group-rating'));
      if (!res.ok) throw new Error('Не вдалося завантажити рейтинг');
      const data = await res.json();
      renderRating(data);
      renderNominations(data);
      renderGroupsCharts(data);
      quickStats.render(data);
      liveFeed.addItem(
        'Рейтинг оновлено',
        `Завантажено ${data.length} груп`,
        '📊',
      );
    } catch (e) {
      ratingList.innerHTML = `<div class="error-banner">${e.message}</div>`;
    }
  }

  function openGroupModal(group) {
    modalTitle.textContent = `Група ${group.groupName}`;
    groupAvg.textContent = group.averageGradeFormatted;
    groupCount.textContent = group.studentCount;

    const attValue =
      parseFloat(group.averageAttendance) || parseFloat(group.attendance) || 0;
    if (attValue > 0) {
      groupAttendance.textContent = `${attValue.toFixed(1)}%`;
      groupAttendance.style.color = '';
    } else {
      groupAttendance.textContent = 'н/д';
      groupAttendance.style.color = '#94a3b8';
    }

    let excellentCount = 0;
    if (group.topStudents) {
      excellentCount = group.topStudents.filter(
        (s) => (parseFloat(s.average) || 0) >= 90,
      ).length;
    }
    groupExcellent.textContent = excellentCount;
    bestStudentsList.innerHTML = '';
    if (group.topStudents) {
      group.topStudents.forEach((student, index) => {
        const li = document.createElement('li');
        li.className = 'best-student-item';
        const avg = parseFloat(student.average) || 0;
        const hasFireStreak = avg >= 95;
        const fireIcon = hasFireStreak
          ? '<span class="fire-streak" title="5+ оцінок 95+">🔥<span class="fire-count">5</span></span>'
          : '';
        let rankClass;
        if (index === 0) rankClass = 'rank-gold';
        else if (index === 1) rankClass = 'rank-silver';
        else if (index === 2) rankClass = 'rank-bronze';
        else rankClass = 'rank-regular';
        li.innerHTML = `
          <span class="student-rank ${rankClass}">${index + 1}</span>
          <span class="avatar avatar-small">${getInitials(student.fullName)}</span>
          <span class="student-name">${student.fullName}${fireIcon}</span>
          <span class="student-score">${student.averageFormatted || student.average || '—'}</span>
        `;
        bestStudentsList.appendChild(li);
      });
    }
    modal.hidden = false;
    modalBackdrop.hidden = false;
  }

  function closeModal() {
    modal.hidden = true;
    modalBackdrop.hidden = true;
  }

  function renderRating(groups) {
    if (!groups || groups.length === 0) {
      ratingList.innerHTML = '<p class="empty-state">Рейтинг порожній</p>';
      return;
    }

    ratingList.innerHTML = '';
    groups.forEach((group, index) => {
      const card = document.createElement('div');
      card.className = 'rating-card';
      card.style.cursor = 'pointer';
      if (index < 3) card.classList.add(`top-${index + 1}`);
      const attValue =
        parseFloat(group.averageAttendance) ||
        parseFloat(group.attendance) ||
        0;

      const excellentCount = group.topStudents
        ? group.topStudents.filter((s) => (parseFloat(s.average) || 0) >= 90)
            .length
        : 0;

      card.innerHTML = `
        <div class="rating-rank">${getMedal(index)}</div>
        <div class="rating-info">
          <div class="rating-group-header">
            <div class="rating-group-name">${group.groupName}</div>
          </div>
          <div class="rating-best-student">Найкращий: <strong>${group.bestStudent?.fullName || '—'}</strong> (${group.bestStudent?.averageFormatted || '—'})</div>
          <div class="rating-stats-row">
            <span class="rating-stat"><span class="rating-stat-label">Відмінників:</span> <strong>${excellentCount}</strong></span>
            ${attValue > 0 ? `<span class="rating-stat"><span class="rating-stat-label">Відвідуваність:</span> <strong>${attValue.toFixed(1)}%</strong></span>` : ''}
          </div>
        </div>
        <div class="rating-score">
          <div class="rating-avg-label">Середній бал</div>
          <div class="rating-avg-value">${group.averageGradeFormatted}</div>
        </div>
      `;
      card.addEventListener('click', () => openGroupModal(group));
      ratingList.appendChild(card);
    });
  }

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  liveFeed.startMockUpdates();

  const cancelExportBtn = $('#cancelExport');
  if (cancelExportBtn) {
    cancelExportBtn.addEventListener('click', () => {
      exportManager.cancel();
    });
  }

  appEvents.subscribe('export:complete', () => {
    liveFeed.addItem('Експорт завершено', 'Файл успішно створено', '📤');
  });

  appEvents.subscribe('feed:updated', (item) => {
    console.log('[EventBus] Feed updated:', item.title);
  });

  loadMeta();
  loadRating();
})();
