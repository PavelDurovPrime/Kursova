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
  const groupsChartCanvas = $('#groupsChart');
  const topAttendanceCard = $('#topAttendance');
  const mostImprovedCard = $('#mostImproved');

  let groupsData = [];
  let groupsChartInstance = null;

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
    if (index === 0) return '<span class="crown-icon" title="1 місце">👑</span>';
    if (index === 1) return '<span class="crown-icon" title="2 місце">🥈</span>';
    if (index === 2) return '<span class="crown-icon" title="3 місце">🥉</span>';
    return `<span class="rank-num">${index + 1}</span>`;
  }

  function getMedal(index) {
    if (index === 0) return '<span class="crown-icon" title="1 місце">👑</span>';
    if (index === 1) return '<span class="crown-icon" title="2 місце">🥈</span>';
    if (index === 2) return '<span class="crown-icon" title="3 місце">🥉</span>';
    return `<span class="rank-num">${index + 1}</span>`;
  }

  function getProgressClass(score) {
    if (score >= 90) return 'progress-excellent';
    if (score >= 75) return 'progress-good';
    if (score >= 60) return 'progress-average';
    return 'progress-poor';
  }

  function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  function renderGroupsChart(groups) {
    if (!groupsChartCanvas || !window.Chart) return;
    if (groupsChartInstance) {
      groupsChartInstance.destroy();
      groupsChartInstance = null;
    }

    const topGroups = groups.slice(0, 5);
    const labels = topGroups.map(g => g.groupName);

    const avgScores = topGroups.map(g => parseFloat(g.averageGrade) || 0);
    const attendanceScores = topGroups.map(g => {
      const att = parseFloat(g.averageAttendance) || parseFloat(g.attendance) || 0;
      return att;
    });
    const excellentScores = topGroups.map(g => {
      const exc = g.topStudents ? g.topStudents.filter(s => (parseFloat(s.average) || 0) >= 90).length : 0;
      const total = g.studentCount || 1;
      return Math.round((exc / total) * 100);
    });
    const studentCounts = topGroups.map(g => {
      const maxStudents = Math.max(...topGroups.map(gr => gr.studentCount || 0)) || 1;
      return Math.round(((g.studentCount || 0) / maxStudents) * 100);
    });

    const ctx = groupsChartCanvas.getContext('2d');

    groupsChartInstance = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Середній бал', 'Відвідуваність', 'Відмінники (%)', 'Кількість студентів'],
        datasets: topGroups.map((g, i) => {
          const colors = [
            { border: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' },
            { border: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' },
            { border: '#d97706', bg: 'rgba(217, 119, 6, 0.15)' },
            { border: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' },
            { border: '#0f172a', bg: 'rgba(15, 23, 42, 0.1)' }
          ];
          return {
            label: g.groupName,
            data: [avgScores[i], attendanceScores[i], excellentScores[i], studentCounts[i]],
            borderColor: colors[i]?.border || '#64748b',
            backgroundColor: colors[i]?.bg || 'rgba(100, 116, 139, 0.1)',
            borderWidth: 2,
            pointBackgroundColor: colors[i]?.border || '#64748b',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true
          };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              font: { size: 12, weight: '600' },
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const groupIdx = context.datasetIndex;
                const metricIdx = context.dataIndex;
                const group = topGroups[groupIdx];
                const value = context.raw;

                if (metricIdx === 0) return `${group.groupName}: Середній бал ${group.averageGradeFormatted || value}`;
                if (metricIdx === 1) {
                  const att = parseFloat(group.averageAttendance) || parseFloat(group.attendance) || 0;
                  return `${group.groupName}: Відвідуваність ${att.toFixed(1)}%`;
                }
                if (metricIdx === 2) {
                  const exc = group.topStudents ? group.topStudents.filter(s => (parseFloat(s.average) || 0) >= 90).length : 0;
                  return `${group.groupName}: Відмінників ${exc}`;
                }
                if (metricIdx === 3) return `${group.groupName}: Студентів ${group.studentCount || 0}`;
                return `${context.dataset.label}: ${value}`;
              }
            }
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            min: 0,
            ticks: {
              stepSize: 20,
              backdropColor: 'transparent',
              color: '#64748b',
              font: { size: 10 }
            },
            grid: { color: 'rgba(0, 0, 0, 0.05)' },
            angleLines: { color: 'rgba(0, 0, 0, 0.05)' },
            pointLabels: {
              color: '#334155',
              font: { size: 12, weight: '600' },
              padding: 20
            }
          }
        }
      }
    });
  }

  function renderNominations(groups) {
    if (!groups || groups.length === 0) return;
    const topAttGroup = groups.reduce((best, current) => {
      const bestAtt = parseFloat(best.averageAttendance) || parseFloat(best.attendance) || 0;
      const currAtt = parseFloat(current.averageAttendance) || parseFloat(current.attendance) || 0;
      return currAtt > bestAtt ? current : best;
    }, groups[0]);
    if (topAttendanceCard && topAttGroup) {
      const attValue = parseFloat(topAttGroup.averageAttendance) || parseFloat(topAttGroup.attendance) || 0;
      topAttendanceCard.querySelector('.nomination-group').textContent = topAttGroup.groupName;
      topAttendanceCard.querySelector('.nomination-value').textContent = 
        `${attValue.toFixed(1)}% відвідуваність`;
    }
    const mostImproved = groups.reduce((best, current) => {
      const bestAvg = parseFloat(best.averageGrade) || 0;
      const currAvg = parseFloat(current.averageGrade) || 0;
      return currAvg > bestAvg ? current : best;
    }, groups[0]);
    if (mostImprovedCard && mostImproved) {
      mostImprovedCard.querySelector('.nomination-group').textContent = mostImproved.groupName;
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
      groupsData = data;
      renderRating(data);
      renderNominations(data);
    } catch (e) {
      ratingList.innerHTML = `<div class="error-banner">${e.message}</div>`;
    }
  }

  function openGroupModal(group) {
    modalTitle.textContent = `Група ${group.groupName}`;
    groupAvg.textContent = group.averageGradeFormatted;
    groupCount.textContent = group.studentCount;
    
    const attValue = parseFloat(group.averageAttendance) || parseFloat(group.attendance) || 0;
    if (attValue > 0) {
      groupAttendance.textContent = attValue.toFixed(1) + '%';
      groupAttendance.style.color = '';
    } else {
      groupAttendance.textContent = 'н/д';
      groupAttendance.style.color = '#94a3b8';
    }
    
    let excellentCount = 0;
    if (group.topStudents) {
      excellentCount = group.topStudents.filter(s => (parseFloat(s.average) || 0) >= 90).length;
    }
    groupExcellent.textContent = excellentCount;
    bestStudentsList.innerHTML = '';
    if (group.topStudents) {
      group.topStudents.forEach((student, index) => {
        const li = document.createElement('li');
        li.className = 'best-student-item';
        const avg = parseFloat(student.average) || 0;
        const hasFireStreak = avg >= 95;
        const fireIcon = hasFireStreak ? '<span class="fire-streak" title="5+ оцінок 95+">🔥<span class="fire-count">5</span></span>' : '';
        li.innerHTML = `
          <span class="student-rank">${index + 1}</span>
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
      const attValue = parseFloat(group.averageAttendance) || parseFloat(group.attendance) || 0;
      
      const excellentCount = group.topStudents ? group.topStudents.filter(s => (parseFloat(s.average) || 0) >= 90).length : 0;
      
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
  loadMeta();
  loadRating();
})();
