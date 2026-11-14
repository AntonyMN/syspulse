/**
 * SysPulse: Frontend Application Controller
 * Handles real-time polling, Chart.js graphs, process crossing, sorting, and termination.
 */

// Global State
const state = {
  isDemo: false,
  activeTab: 'tab-overview',
  refreshInterval: 2000,
  refreshTimer: null,
  progressTimer: null,
  lastRefreshTime: Date.now(),
  currentUser: 'anto',
  serverPid: null,

  // Condition & Issues
  issueFilter: 'all',
  issuesData: [],

  // RAM Metrics & Charts
  timelineChart: null,
  doughnutChart: null,
  ramHistory: [],

  // Processes State
  processCategory: 'all', // 'all', 'active', 'background'
  processUser: 'all',     // 'all', 'me'
  searchQuery: '',
  sortColumn: 'is_active',
  sortAsc: false,
  page: 1,
  pageSize: 25,
  processes: [],
  crossedPids: new Set(),

  // Running Applications State (Tab 4)
  appsFilter: 'all',
  appsSearch: '',
  appsSort: 'memory',
  applications: [],
  expandedAppIds: new Set(),
  targetKillApp: null,
  targetUninstallApp: null
};

// DOM Elements
const DOM = {
  // Navigation
  tabs: document.querySelectorAll('.nav-tab'),
  tabContents: document.querySelectorAll('.tab-content'),
  refreshSelect: document.getElementById('refreshSelect'),
  btnManualRefresh: document.getElementById('btnManualRefresh'),
  refreshIcon: document.getElementById('refreshIcon'),
  countdownBar: document.getElementById('countdownBar'),
  livePill: document.getElementById('livePill'),
  
  // Header Info
  sysHostname: document.getElementById('sysHostname'),
  sysOs: document.getElementById('sysOs'),
  sysUptime: document.getElementById('sysUptime'),
  issuesCountBadge: document.getElementById('issuesCountBadge'),
  ramQuickBadge: document.getElementById('ramQuickBadge'),
  activeProcsCountBadge: document.getElementById('activeProcsCountBadge'),

  // Condition Tab
  healthHeroCard: document.getElementById('healthHeroCard'),
  scoreCircleBar: document.getElementById('scoreCircleBar'),
  healthScoreNum: document.getElementById('healthScoreNum'),
  healthGradeBadge: document.getElementById('healthGradeBadge'),
  healthStatusTitle: document.getElementById('healthStatusTitle'),
  healthStatusPill: document.getElementById('healthStatusPill'),
  healthDescription: document.getElementById('healthDescription'),
  healthDeductionsList: document.getElementById('healthDeductionsList'),
  quickStatTemp: document.getElementById('quickStatTemp'),
  quickStatTempSub: document.getElementById('quickStatTempSub'),
  quickStatBatteryWear: document.getElementById('quickStatBatteryWear'),
  quickStatBatteryCycles: document.getElementById('quickStatBatteryCycles'),
  quickStatStorage: document.getElementById('quickStatStorage'),
  quickStatStorageFree: document.getElementById('quickStatStorageFree'),

  // Hardware Grid
  thermalStatusBadge: document.getElementById('thermalStatusBadge'),
  cpuPackageTemp: document.getElementById('cpuPackageTemp'),
  cpuTempTag: document.getElementById('cpuTempTag'),
  cpuSensorsList: document.getElementById('cpuSensorsList'),
  batteryStateBadge: document.getElementById('batteryStateBadge'),
  batteryLevelNum: document.getElementById('batteryLevelNum'),
  batteryPluggedTag: document.getElementById('batteryPluggedTag'),
  batteryHealthPct: document.getElementById('batteryHealthPct'),
  batteryWearPct: document.getElementById('batteryWearPct'),
  batteryCycleCount: document.getElementById('batteryCycleCount'),
  batteryAssessmentText: document.getElementById('batteryAssessmentText'),
  diskStatusBadge: document.getElementById('diskStatusBadge'),
  diskUsedPercent: document.getElementById('diskUsedPercent'),
  diskUsageBar: document.getElementById('diskUsageBar'),
  diskUsedStr: document.getElementById('diskUsedStr'),
  diskFreeStr: document.getElementById('diskFreeStr'),
  diskTotalStr: document.getElementById('diskTotalStr'),
  cpuCountNum: document.getElementById('cpuCountNum'),
  loadAvg1: document.getElementById('loadAvg1'),
  loadAvg5: document.getElementById('loadAvg5'),
  loadAvg15: document.getElementById('loadAvg15'),
  activeUserSpan: document.getElementById('activeUserSpan'),

  // Issues Section
  issuesListContainer: document.getElementById('issuesListContainer'),
  issueFilterBtns: document.querySelectorAll('[data-issue-filter]'),
  totalIssuesCount: document.getElementById('totalIssuesCount'),
  critIssuesCount: document.getElementById('critIssuesCount'),
  warnIssuesCount: document.getElementById('warnIssuesCount'),
  infoIssuesCount: document.getElementById('infoIssuesCount'),

  // RAM Tab
  ramUsedHero: document.getElementById('ramUsedHero'),
  ramUsedPctHero: document.getElementById('ramUsedPctHero'),
  ramAvailHero: document.getElementById('ramAvailHero'),
  ramAvailPctHero: document.getElementById('ramAvailPctHero'),
  barUsed: document.getElementById('barUsed'),
  barCached: document.getElementById('barCached'),
  barBuffers: document.getElementById('barBuffers'),
  barFree: document.getElementById('barFree'),
  legendUsed: document.getElementById('legendUsed'),
  legendCached: document.getElementById('legendCached'),
  legendBuffers: document.getElementById('legendBuffers'),
  legendFree: document.getElementById('legendFree'),
  specTotalRam: document.getElementById('specTotalRam'),
  specSharedRam: document.getElementById('specSharedRam'),
  specSwapUsed: document.getElementById('specSwapUsed'),
  specMemPressure: document.getElementById('specMemPressure'),
  ramTimelineCanvas: document.getElementById('ramTimelineChart'),
  ramDoughnutCanvas: document.getElementById('ramDoughnutChart'),

  // Process Tab
  pillBtns: document.querySelectorAll('.pill-btn[data-proc-cat]'),
  userToggleBtns: document.querySelectorAll('.toggle-btn[data-proc-user]'),
  badgeAllProcs: document.getElementById('badgeAllProcs'),
  badgeActiveProcs: document.getElementById('badgeActiveProcs'),
  badgeBgProcs: document.getElementById('badgeBgProcs'),
  procSearchInput: document.getElementById('procSearchInput'),
  btnClearSearch: document.getElementById('btnClearSearch'),
  btnCrossAllActive: document.getElementById('btnCrossAllActive'),
  btnUncrossAll: document.getElementById('btnUncrossAll'),
  btnKillCrossed: document.getElementById('btnKillCrossed'),
  btnKillCrossedText: document.getElementById('btnKillCrossedText'),
  btnKillAllActive: document.getElementById('btnKillAllActive'),
  crossedTrackerBanner: document.getElementById('crossedTrackerBanner'),
  crossedCountNumber: document.getElementById('crossedCountNumber'),
  btnExecuteCrossedKill: document.getElementById('btnExecuteCrossedKill'),
  btnDismissCrossed: document.getElementById('btnDismissCrossed'),
  processTableBody: document.getElementById('processTableBody'),
  tableShowingCount: document.getElementById('tableShowingCount'),
  btnPrevPage: document.getElementById('btnPrevPage'),
  btnNextPage: document.getElementById('btnNextPage'),
  pageIndicator: document.getElementById('pageIndicator'),
  sortHeaders: document.querySelectorAll('.process-table th.sortable'),

  // Modals
  killAllActiveModal: document.getElementById('killAllActiveModal'),
  btnCloseKillActiveModal: document.getElementById('btnCloseKillActiveModal'),
  btnCancelKillActiveModal: document.getElementById('btnCancelKillActiveModal'),
  btnConfirmKillAllActive: document.getElementById('btnConfirmKillAllActive'),
  modalServerPid: document.getElementById('modalServerPid'),
  modalActiveTargetsList: document.getElementById('modalActiveTargetsList'),

  killCrossedModal: document.getElementById('killCrossedModal'),
  btnCloseCrossedModal: document.getElementById('btnCloseCrossedModal'),
  btnCancelCrossedModal: document.getElementById('btnCancelCrossedModal'),
  btnConfirmKillCrossed: document.getElementById('btnConfirmKillCrossed'),
  modalCrossedCount: document.getElementById('modalCrossedCount'),
  modalCrossedTargetsList: document.getElementById('modalCrossedTargetsList'),

  // Applications Tab (Tab 4)
  appsCountBadge: document.getElementById('appsCountBadge'),
  appStatTotal: document.getElementById('appStatTotal'),
  appStatSubCount: document.getElementById('appStatSubCount'),
  appStatRam: document.getElementById('appStatRam'),
  appStatHeaviestName: document.getElementById('appStatHeaviestName'),
  appStatHeaviestUsage: document.getElementById('appStatHeaviestUsage'),
  appStatTopCpuName: document.getElementById('appStatTopCpuName'),
  appStatTopCpuUsage: document.getElementById('appStatTopCpuUsage'),
  appFilterBtns: document.querySelectorAll('[data-app-filter]'),
  badgeAllApps: document.getElementById('badgeAllApps'),
  badgeUserApps: document.getElementById('badgeUserApps'),
  badgeHeavyApps: document.getElementById('badgeHeavyApps'),
  badgeDaemonApps: document.getElementById('badgeDaemonApps'),
  appSearchInput: document.getElementById('appSearchInput'),
  btnClearAppSearch: document.getElementById('btnClearAppSearch'),
  appSortBtns: document.querySelectorAll('[data-app-sort]'),
  btnExpandAllApps: document.getElementById('btnExpandAllApps'),
  btnCollapseAllApps: document.getElementById('btnCollapseAllApps'),
  appsListContainer: document.getElementById('appsListContainer'),

  // Kill App Modal
  killAppModal: document.getElementById('killAppModal'),
  btnCloseKillAppModal: document.getElementById('btnCloseKillAppModal'),
  btnCancelKillAppModal: document.getElementById('btnCancelKillAppModal'),
  btnConfirmKillApp: document.getElementById('btnConfirmKillApp'),
  modalKillAppName: document.getElementById('modalKillAppName'),
  modalKillAppProcCount: document.getElementById('modalKillAppProcCount'),
  modalKillAppRam: document.getElementById('modalKillAppRam'),

  // Uninstall App Modal
  uninstallModal: document.getElementById('uninstallModal'),
  btnCloseUninstallModal: document.getElementById('btnCloseUninstallModal'),
  btnCloseUninstallDialog: document.getElementById('btnCloseUninstallDialog'),
  modalUninstallIcon: document.getElementById('modalUninstallIcon'),
  modalUninstallTitle: document.getElementById('modalUninstallTitle'),
  modalUninstallPkgManager: document.getElementById('modalUninstallPkgManager'),
  modalUninstallPkgName: document.getElementById('modalUninstallPkgName'),
  modalUninstallVersion: document.getElementById('modalUninstallVersion'),
  modalUninstallSize: document.getElementById('modalUninstallSize'),
  modalUninstallDesc: document.getElementById('modalUninstallDesc'),
  modalUninstallProcAlert: document.getElementById('modalUninstallProcAlert'),
  chkUninstallKillFirst: document.getElementById('chkUninstallKillFirst'),
  modalUninstallCmdSnippet: document.getElementById('modalUninstallCmdSnippet'),
  btnCopyUninstallCmd: document.getElementById('btnCopyUninstallCmd'),
  copyCmdText: document.getElementById('copyCmdText'),
  sudoPasswordInput: document.getElementById('sudoPasswordInput'),
  btnTogglePwd: document.getElementById('btnTogglePwd'),
  btnSimulateUninstall: document.getElementById('btnSimulateUninstall'),
  btnExecuteUninstall: document.getElementById('btnExecuteUninstall'),
  uninstallConsoleWrap: document.getElementById('uninstallConsoleWrap'),
  uninstallConsoleStatus: document.getElementById('uninstallConsoleStatus'),
  uninstallConsoleOutput: document.getElementById('uninstallConsoleOutput'),

  toastContainer: document.getElementById('toastContainer'),
  demoBanner: document.getElementById('demoBanner')
};

// ============================================================================
// Initialization
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  checkDemoMode();
  setupTabs();
  setupRefreshControls();
  setupProcessControls();
  setupApplicationControls();
  setupModals();
  initCharts();

  // Initial Fetch
  fetchAllData();
  startAutoRefresh();
});

// ============================================================================
// Toast System
// ============================================================================
function showToast(message, type = 'info', duration = 3500) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  } else {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  }

  toast.innerHTML = `${iconSvg}<span>${message}</span>`;
  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============================================================================
// Tabs Navigation
// ============================================================================
function setupTabs() {
  DOM.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      state.activeTab = targetTab;

      DOM.tabs.forEach(t => t.classList.remove('active'));
      DOM.tabContents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const content = document.getElementById(targetTab);
      if (content) content.classList.add('active');

      // Resize charts if tab switched to RAM
      if (targetTab === 'tab-ram' && state.timelineChart) {
        setTimeout(() => {
          state.timelineChart.resize();
          if (state.doughnutChart) state.doughnutChart.resize();
        }, 100);
      } else if (targetTab === 'tab-apps') {
        fetchApplications();
      }
    });
  });
}

// ============================================================================
// Refresh & Polling Controls
// ============================================================================
function setupRefreshControls() {
  DOM.refreshSelect.addEventListener('change', (e) => {
    state.refreshInterval = parseInt(e.target.value, 10);
    startAutoRefresh();
    showToast(`Refresh interval set to ${state.refreshInterval ? state.refreshInterval/1000 + 's' : 'Paused'}`, 'info');
  });

  DOM.btnManualRefresh.addEventListener('click', () => {
    DOM.refreshIcon.classList.add('rotating');
    fetchAllData().finally(() => {
      setTimeout(() => DOM.refreshIcon.classList.remove('rotating'), 500);
    });
  });
}

function startAutoRefresh() {
  if (state.refreshTimer) clearInterval(state.refreshTimer);
  if (state.progressTimer) clearInterval(state.progressTimer);

  if (state.refreshInterval <= 0) {
    DOM.countdownBar.style.width = '0%';
    return;
  }

  state.lastRefreshTime = Date.now();
  
  // Progress bar ticker (every 50ms)
  state.progressTimer = setInterval(() => {
    const elapsed = Date.now() - state.lastRefreshTime;
    const pct = Math.max(0, 100 - (elapsed / state.refreshInterval) * 100);
    DOM.countdownBar.style.width = `${pct}%`;
  }, 50);

  state.refreshTimer = setInterval(() => {
    state.lastRefreshTime = Date.now();
    fetchAllData();
  }, state.refreshInterval);
}

// ============================================================================
// Data Fetching
// ============================================================================
async function fetchAllData() {
  try {
    const promises = [fetchCondition(), fetchRam(), fetchProcesses(), fetchApplications(true)];
    await Promise.all(promises);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

// ============================================================================
// 1. LAPTOP CONDITION & ISSUES
// ============================================================================
async function fetchCondition() {
  if (state.isDemo) {
    renderCondition(getDemoConditionData());
    return;
  }
  try {
    const res = await fetch('/api/system/condition');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    renderCondition(data);
  } catch (err) {
    console.warn('Condition fetch failed:', err);
    if (!state.isDemo && shouldFallbackToDemo()) {
      enableDemoMode();
      renderCondition(getDemoConditionData());
    }
  }
}

function renderCondition(data) {
  const sys = data.system || {};
  const hs = data.health_score || {};
  const bat = data.battery || {};
  const therm = data.thermals || {};
  const disks = data.storage || [];
  const issues = data.issues || [];

  state.currentUser = sys.current_user || 'anto';
  const userBtn = document.getElementById('userMeToggleBtn');
  if (userBtn) userBtn.textContent = `User (${state.currentUser})`;

  // Header info chips
  DOM.sysHostname.textContent = sys.hostname || 'ubuntu';
  DOM.sysOs.textContent = `${sys.os_name || 'Ubuntu'} (${sys.cpu_count} cores)`;
  
  // Uptime formatting
  const upSec = sys.uptime_seconds || 0;
  const hours = Math.floor(upSec / 3600);
  const mins = Math.floor((upSec % 3600) / 60);
  DOM.sysUptime.textContent = `${hours}h ${mins}m`;

  // Health Score Circular Gauge
  const score = hs.score || 0;
  DOM.healthScoreNum.textContent = score;
  DOM.healthGradeBadge.textContent = hs.grade || 'B';
  DOM.healthGradeBadge.className = `health-grade-badge grade-${hs.color || 'emerald'}`;
  
  // Update circular dash offset (Circumference ~314.16)
  const offset = 314.16 - (score / 100) * 314.16;
  DOM.scoreCircleBar.style.strokeDashoffset = offset;
  
  let scoreColor = '#10b981';
  if (hs.color === 'rose' || hs.color === 'orange') scoreColor = '#f43f5e';
  else if (hs.color === 'amber') scoreColor = '#f59e0b';
  DOM.scoreCircleBar.style.stroke = scoreColor;

  DOM.healthStatusTitle.textContent = hs.status_text || 'Hardware Analysis';
  DOM.healthStatusPill.textContent = `Grade ${hs.grade}`;
  DOM.healthStatusPill.style.color = scoreColor;
  DOM.healthStatusPill.style.borderColor = scoreColor;

  // Deductions tags
  DOM.healthDeductionsList.innerHTML = '';
  if (hs.deductions && hs.deductions.length > 0) {
    hs.deductions.forEach(d => {
      const tag = document.createElement('span');
      tag.className = 'deduction-tag';
      tag.textContent = d;
      DOM.healthDeductionsList.appendChild(tag);
    });
  }

  // Quick hero stats
  DOM.quickStatTemp.textContent = `${therm.max_temp || '--'}°C`;
  DOM.quickStatTempSub.textContent = therm.status || 'Sensors';
  
  DOM.quickStatBatteryWear.textContent = bat.wear_percent !== null ? `${bat.wear_percent}%` : 'N/A';
  DOM.quickStatBatteryCycles.textContent = bat.cycle_count ? `${bat.cycle_count} cycles` : (bat.status || 'N/A');

  const rootDisk = disks.find(d => d.mountpoint === '/') || disks[0] || {};
  DOM.quickStatStorage.textContent = rootDisk.percent ? `${rootDisk.percent}%` : '--%';
  DOM.quickStatStorageFree.textContent = rootDisk.free_str ? `${rootDisk.free_str} free` : '--';

  // Hardware Grid: Thermals
  DOM.cpuPackageTemp.textContent = therm.package_temp || therm.max_temp || '--';
  DOM.cpuTempTag.textContent = therm.status || 'Normal';
  DOM.thermalStatusBadge.textContent = therm.max_temp >= 80 ? 'Warm' : 'Normal';
  DOM.thermalStatusBadge.className = `status-indicator ${therm.max_temp >= 80 ? 'warning-status' : 'optimal-status'}`;

  // Populate core sensor bars
  DOM.cpuSensorsList.innerHTML = '';
  const coreTemps = (therm.sensors && therm.sensors.coretemp) ? therm.sensors.coretemp : [];
  if (coreTemps.length > 0) {
    coreTemps.slice(0, 4).forEach(ct => {
      const row = document.createElement('div');
      row.className = 'sensor-bar-item';
      row.innerHTML = `<span>${ct.label || 'Core'}:</span><strong>${ct.current}°C</strong>`;
      DOM.cpuSensorsList.appendChild(row);
    });
  } else {
    DOM.cpuSensorsList.innerHTML = `<div class="sensor-bar-item"><span>Thermal Zones:</span><strong>${therm.max_temp}°C</strong></div>`;
  }

  // Hardware Grid: Battery
  DOM.batteryLevelNum.textContent = bat.percent || '--';
  DOM.batteryPluggedTag.textContent = bat.power_plugged ? 'AC Plugged' : 'On Battery';
  DOM.batteryStateBadge.textContent = bat.status || 'Unknown';
  DOM.batteryHealthPct.textContent = bat.health_percent !== null ? `${bat.health_percent}%` : 'N/A';
  DOM.batteryWearPct.textContent = bat.wear_percent !== null ? `${bat.wear_percent}%` : 'N/A';
  DOM.batteryCycleCount.textContent = bat.cycle_count ? `${bat.cycle_count} cycles` : 'N/A';
  DOM.batteryAssessmentText.textContent = bat.assessment || 'Normal';

  // Hardware Grid: Storage
  DOM.diskUsedPercent.textContent = rootDisk.percent || '--';
  DOM.diskUsageBar.style.width = `${rootDisk.percent || 0}%`;
  DOM.diskUsedStr.textContent = rootDisk.used_str || '--';
  DOM.diskFreeStr.textContent = rootDisk.free_str || '--';
  DOM.diskTotalStr.textContent = rootDisk.total_str || '--';
  if ((rootDisk.percent || 0) >= 90) {
    DOM.diskStatusBadge.textContent = 'CRITICAL';
    DOM.diskStatusBadge.className = 'status-indicator danger-status';
  } else {
    DOM.diskStatusBadge.textContent = 'HEALTHY';
    DOM.diskStatusBadge.className = 'status-indicator optimal-status';
  }

  // Hardware Grid: CPU Load
  DOM.cpuCountNum.textContent = sys.cpu_count || '--';
  if (sys.load_avg && sys.load_avg.length >= 3) {
    DOM.loadAvg1.textContent = sys.load_avg[0];
    DOM.loadAvg5.textContent = sys.load_avg[1];
    DOM.loadAvg15.textContent = sys.load_avg[2];
  }
  DOM.activeUserSpan.textContent = sys.current_user || 'anto';

  // Issues Section
  state.issuesData = issues;
  renderIssues();
}

function renderIssues() {
  const issues = state.issuesData;
  const filtered = issues.filter(item => {
    if (state.issueFilter === 'all') return true;
    return item.severity === state.issueFilter;
  });

  // Count badges
  DOM.totalIssuesCount.textContent = issues.length;
  DOM.critIssuesCount.textContent = issues.filter(i => i.severity === 'critical').length;
  DOM.warnIssuesCount.textContent = issues.filter(i => i.severity === 'warning').length;
  DOM.infoIssuesCount.textContent = issues.filter(i => i.severity === 'info').length;
  DOM.issuesCountBadge.textContent = issues.length;

  if (filtered.length === 0) {
    DOM.issuesListContainer.innerHTML = `<div class="empty-state">No issues matching "${state.issueFilter}". System running cleanly.</div>`;
    return;
  }

  DOM.issuesListContainer.innerHTML = '';
  filtered.forEach(issue => {
    const card = document.createElement('div');
    card.className = `issue-card severity-${issue.severity || 'warning'}`;
    
    let iconSvg = '';
    if (issue.severity === 'critical') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    } else if (issue.severity === 'warning') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    } else {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    card.innerHTML = `
      <div class="issue-icon-box">${iconSvg}</div>
      <div class="issue-content">
        <div class="issue-title-row">
          <span class="issue-title">${issue.title}</span>
          <span class="issue-category-tag">${issue.category || 'System'}</span>
        </div>
        <div class="issue-desc">${escapeHtml(issue.description)}</div>
        ${issue.recommendation ? `
          <div class="issue-recommendation">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            <span>${issue.recommendation}</span>
          </div>
        ` : ''}
      </div>
      <div>
        <span class="status-indicator ${issue.severity === 'critical' ? 'danger-status' : 'warning-status'}">${(issue.severity || 'WARN').toUpperCase()}</span>
      </div>
    `;
    DOM.issuesListContainer.appendChild(card);
  });
}

// Issues filter click handling
DOM.issueFilterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    DOM.issueFilterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.issueFilter = btn.dataset.issueFilter;
    renderIssues();
  });
});

// ============================================================================
// 2. RAM & MEMORY ANALYTICS & CHARTS
// ============================================================================
function initCharts() {
  if (typeof Chart === 'undefined') {
    console.error('Chart.js not loaded');
    return;
  }

  // Set default Chart.js styling
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.font.family = "'Inter', sans-serif";

  // 1. Timeline Chart (RAM Used vs Available)
  const ctxTimeline = DOM.ramTimelineCanvas.getContext('2d');
  
  // Create gradients
  const gradUsed = ctxTimeline.createLinearGradient(0, 0, 0, 300);
  gradUsed.addColorStop(0, 'rgba(6, 182, 212, 0.45)');
  gradUsed.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

  const gradAvail = ctxTimeline.createLinearGradient(0, 0, 0, 300);
  gradAvail.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
  gradAvail.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

  state.timelineChart = new Chart(ctxTimeline, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Used RAM (GB)',
          data: [],
          borderColor: '#06b6d4',
          borderWidth: 2.5,
          backgroundColor: gradUsed,
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#06b6d4',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2
        },
        {
          label: 'Available RAM (GB)',
          data: [],
          borderColor: '#10b981',
          borderWidth: 2.5,
          backgroundColor: gradAvail,
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#10b981',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleFont: { size: 12, weight: 'bold' },
          bodyFont: { size: 12 },
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 12,
          boxPadding: 6,
          callbacks: {
            label: (context) => ` ${context.dataset.label}: ${context.raw.toFixed(2)} GB`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { font: { size: 10 }, maxTicksLimit: 12 }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            font: { size: 11 },
            callback: (v) => `${v} GB`
          },
          suggestedMin: 0,
          suggestedMax: 16
        }
      }
    }
  });

  // 2. Doughnut Distribution Chart
  const ctxDoughnut = DOM.ramDoughnutCanvas.getContext('2d');
  state.doughnutChart = new Chart(ctxDoughnut, {
    type: 'doughnut',
    data: {
      labels: ['Used', 'Cached', 'Buffers', 'Free'],
      datasets: [{
        data: [0, 0, 0, 0],
        backgroundColor: [
          '#06b6d4', // Used: Cyan
          '#8b5cf6', // Cached: Purple
          '#f59e0b', // Buffers: Amber
          '#10b981'  // Free: Emerald
        ],
        borderColor: '#0f172a',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      animation: { duration: 500 },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 12,
            padding: 14,
            font: { size: 11 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.raw.toFixed(2)} GB`
          }
        }
      }
    }
  });
}

async function fetchRam() {
  if (state.isDemo) {
    renderRam(getDemoRamData());
    return;
  }
  try {
    const res = await fetch('/api/memory/stats');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    renderRam(data);
  } catch (err) {
    console.warn('RAM fetch failed:', err);
    if (!state.isDemo && shouldFallbackToDemo()) {
      enableDemoMode();
      renderRam(getDemoRamData());
    }
  }
}

function renderRam(data) {
  const ram = data.ram || {};
  const swap = data.swap || {};
  const pressure = data.pressure || {};
  const history = data.history || [];

  DOM.ramQuickBadge.textContent = `${ram.percent}%`;

  // Hero Numbers
  DOM.ramUsedHero.textContent = ram.used_gb || '--';
  DOM.ramUsedPctHero.textContent = `${ram.percent}% of total memory`;
  DOM.ramAvailHero.textContent = ram.available_gb || '--';
  const availPct = Math.round(100 - (ram.percent || 0));
  DOM.ramAvailPctHero.textContent = `${availPct}% available for apps`;

  // Stacked Bar
  const total = ram.total || 1;
  const pUsed = ((ram.used || 0) / total) * 100;
  const pCached = ((ram.cached || 0) / total) * 100;
  const pBuffers = ((ram.buffers || 0) / total) * 100;
  const pFree = ((ram.free || 0) / total) * 100;

  DOM.barUsed.style.width = `${pUsed}%`;
  DOM.barCached.style.width = `${pCached}%`;
  DOM.barBuffers.style.width = `${pBuffers}%`;
  DOM.barFree.style.width = `${pFree}%`;

  DOM.legendUsed.textContent = ram.used_str || '--';
  DOM.legendCached.textContent = `${ram.cached_gb || 0} GB`;
  DOM.legendBuffers.textContent = `${ram.buffers_gb || 0} GB`;
  DOM.legendFree.textContent = ram.free_str || '--';

  // Specs
  DOM.specTotalRam.textContent = `${ram.total_gb || '--'} GB`;
  DOM.specSharedRam.textContent = `${Math.round((ram.shared || 0) / (1024*1024))} MB`;
  DOM.specSwapUsed.textContent = `${swap.used_str} (${swap.percent}%)`;
  DOM.specMemPressure.textContent = `${pressure.some ? pressure.some.toFixed(1) : '0.0'}%`;

  // Update Doughnut Chart
  if (state.doughnutChart) {
    state.doughnutChart.data.datasets[0].data = [
      ram.used_gb || 0,
      ram.cached_gb || 0,
      ram.buffers_gb || 0,
      ram.free_gb || 0
    ];
    state.doughnutChart.update();
  }

  // Update Timeline Line Chart
  if (state.timelineChart && history.length > 0) {
    state.timelineChart.data.labels = history.map(h => h.time);
    state.timelineChart.data.datasets[0].data = history.map(h => h.used_gb);
    state.timelineChart.data.datasets[1].data = history.map(h => h.available_gb);
    
    // Set max scale to total RAM + 1GB for head room
    if (ram.total_gb) {
      state.timelineChart.options.scales.y.suggestedMax = Math.ceil(ram.total_gb);
    }
    state.timelineChart.update('none'); // Update without full redraw animation
  }
}

// ============================================================================
// 3. PROCESS MANAGER & CONTROLLER
// ============================================================================
function setupProcessControls() {
  // Category Pill Buttons
  DOM.pillBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.pillBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.processCategory = btn.dataset.procCat;
      state.page = 1;
      fetchProcesses();
    });
  });

  // User Filter Toggle
  DOM.userToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.userToggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.processUser = btn.dataset.procUser;
      state.page = 1;
      fetchProcesses();
    });
  });

  // Search input
  DOM.procSearchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase().trim();
    DOM.btnClearSearch.style.display = state.searchQuery ? 'block' : 'none';
    state.page = 1;
    renderProcessTable();
  });

  DOM.btnClearSearch.addEventListener('click', () => {
    DOM.procSearchInput.value = '';
    state.searchQuery = '';
    DOM.btnClearSearch.style.display = 'none';
    state.page = 1;
    renderProcessTable();
  });

  // Table Column Sort
  DOM.sortHeaders.forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (state.sortColumn === col) {
        state.sortAsc = !state.sortAsc;
      } else {
        state.sortColumn = col;
        state.sortAsc = (col === 'pid' || col === 'name');
      }

      DOM.sortHeaders.forEach(h => {
        const icon = h.querySelector('.sort-icon');
        if (icon) icon.textContent = '';
      });

      const currentIcon = th.querySelector('.sort-icon');
      if (currentIcon) currentIcon.textContent = state.sortAsc ? '▲' : '▼';

      renderProcessTable();
    });
  });

  // Pagination buttons
  DOM.btnPrevPage.addEventListener('click', () => {
    if (state.page > 1) {
      state.page--;
      renderProcessTable();
    }
  });

  DOM.btnNextPage.addEventListener('click', () => {
    state.page++;
    renderProcessTable();
  });

  // Crossing Actions
  DOM.btnCrossAllActive.addEventListener('click', () => {
    const activeProcs = state.processes.filter(p => p.is_active && !p.is_protected);
    activeProcs.forEach(p => state.crossedPids.add(p.pid));
    updateCrossedUI();
    renderProcessTable();
    showToast(`Crossed ${activeProcs.length} active processes`, 'info');
  });

  DOM.btnUncrossAll.addEventListener('click', () => {
    const count = state.crossedPids.size;
    state.crossedPids.clear();
    updateCrossedUI();
    renderProcessTable();
    showToast(`Uncrossed ${count} processes`, 'info');
  });

  DOM.btnDismissCrossed.addEventListener('click', () => {
    state.crossedPids.clear();
    updateCrossedUI();
    renderProcessTable();
  });

  // Kill Crossed Button in toolbar
  DOM.btnKillCrossed.addEventListener('click', openKillCrossedModal);
  DOM.btnExecuteCrossedKill.addEventListener('click', openKillCrossedModal);

  // Kill All Active Processes Modal trigger
  DOM.btnKillAllActive.addEventListener('click', openKillAllActiveModal);
}

async function fetchProcesses() {
  if (state.isDemo) {
    renderDemoProcesses();
    return;
  }
  try {
    const params = new URLSearchParams({
      category: state.processCategory,
      user: state.processUser
    });
    const res = await fetch(`/api/processes?${params.toString()}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    
    state.processes = data.processes || [];
    const stats = data.stats || {};

    // Update count badges
    DOM.badgeAllProcs.textContent = stats.total || 0;
    DOM.badgeActiveProcs.textContent = stats.active || 0;
    DOM.badgeBgProcs.textContent = stats.background || 0;
    DOM.activeProcsCountBadge.textContent = `${stats.active || 0} Active`;

    renderProcessTable();
    updateCrossedUI();
  } catch (err) {
    console.warn('Process fetch failed:', err);
    if (!state.isDemo && shouldFallbackToDemo()) {
      enableDemoMode();
      renderDemoProcesses();
    }
  }
}

function updateCrossedUI() {
  const count = state.crossedPids.size;
  DOM.btnKillCrossed.disabled = (count === 0);
  DOM.btnKillCrossedText.textContent = `Kill Crossed (${count})`;
  DOM.crossedCountNumber.textContent = count;
  DOM.crossedTrackerBanner.style.display = count > 0 ? 'flex' : 'none';
}

function renderProcessTable() {
  let list = [...state.processes];

  // Apply search query filter
  if (state.searchQuery) {
    const q = state.searchQuery;
    list = list.filter(p => {
      const pidStr = String(p.pid);
      const name = (p.name || '').toLowerCase();
      const cmd = (p.cmdline_str || '').toLowerCase();
      const user = (p.username || '').toLowerCase();
      return pidStr.includes(q) || name.includes(q) || cmd.includes(q) || user.includes(q);
    });
  }

  // Sort list
  list.sort((a, b) => {
    let valA = a[state.sortColumn];
    let valB = b[state.sortColumn];

    if (state.sortColumn === 'is_active') {
      valA = a.is_active ? 1 : 0;
      valB = b.is_active ? 1 : 0;
    }

    if (valA === valB) return 0;
    if (valA === null || valA === undefined) return 1;
    if (valB === null || valB === undefined) return -1;

    let res = 0;
    if (typeof valA === 'string') {
      res = valA.localeCompare(valB);
    } else {
      res = (valA > valB) ? 1 : -1;
    }
    return state.sortAsc ? res : -res;
  });

  // Pagination
  const totalItems = list.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / state.pageSize));
  state.page = Math.min(state.page, totalPages);

  const startIdx = (state.page - 1) * state.pageSize;
  const pageItems = list.slice(startIdx, startIdx + state.pageSize);

  DOM.tableShowingCount.textContent = `Showing ${pageItems.length} of ${totalItems} processes`;
  DOM.pageIndicator.textContent = `Page ${state.page} / ${totalPages}`;
  DOM.btnPrevPage.disabled = (state.page <= 1);
  DOM.btnNextPage.disabled = (state.page >= totalPages);

  if (pageItems.length === 0) {
    DOM.processTableBody.innerHTML = `<tr><td colspan="9" class="loading-td">No processes matching current filters.</td></tr>`;
    return;
  }

  DOM.processTableBody.innerHTML = '';
  pageItems.forEach(p => {
    const isCrossed = state.crossedPids.has(p.pid);
    const tr = document.createElement('tr');
    tr.className = isCrossed ? 'row-crossed' : '';

    // Category badge
    const catClass = p.is_active ? 'badge-proc-active' : 'badge-proc-bg';
    const catBadge = `<span class="proc-category-badge ${catClass}">
      ${p.is_active ? '<span class="live-dot-blue"></span>' : ''}
      ${p.category || 'Background'}
    </span>`;

    // CPU bar
    const cpuPct = p.cpu_percent || 0;
    const cpuBarWidth = Math.min(100, cpuPct * 1.5);
    const cpuColor = cpuPct > 50 ? 'var(--rose-500)' : (cpuPct > 15 ? 'var(--amber-500)' : 'var(--cyan-500)');

    tr.innerHTML = `
      <td>
        <button class="btn-cross-toggle ${isCrossed ? 'is-crossed' : ''}" data-pid="${p.pid}" title="${isCrossed ? 'Uncross process' : 'Cross out process'}">
          ${isCrossed ? '✕' : '✕'}
        </button>
      </td>
      <td class="col-pid"><span class="pid-pill">${p.pid}</span></td>
      <td class="col-name">
        <div class="proc-name-cell">
          <div class="proc-name-main">
            ${escapeHtml(p.name)}
            ${isCrossed ? '<span class="crossed-badge">CROSSED</span>' : ''}
          </div>
          <div class="proc-cmd-sub" title="${escapeHtml(p.cmdline_str)}">${escapeHtml(p.cmdline_str)}</div>
        </div>
      </td>
      <td>${catBadge}</td>
      <td><span class="user-pill">${escapeHtml(p.username)}</span></td>
      <td><span class="status-indicator">${p.status}</span></td>
      <td>
        <div class="cpu-bar-cell">
          <div class="cpu-bar-bg">
            <div class="cpu-bar-fill" style="width: ${cpuBarWidth}%; background: ${cpuColor};"></div>
          </div>
          <span class="cpu-text">${cpuPct.toFixed(1)}%</span>
        </div>
      </td>
      <td>
        <span class="mem-text"><strong>${p.memory_mb} MB</strong> (${p.memory_percent}%)</span>
      </td>
      <td style="text-align: right;">
        <div class="row-actions-group">
          <button class="btn-kill-row" data-pid="${p.pid}" data-pname="${escapeHtml(p.name)}" ${p.is_protected ? 'disabled title="Protected system process"' : 'title="Terminate process"'}>
            Kill
          </button>
        </div>
      </td>
    `;

    // Row Cross Button Event
    const btnCross = tr.querySelector('.btn-cross-toggle');
    btnCross.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCross(p.pid);
    });

    // Row Kill Button Event
    const btnKill = tr.querySelector('.btn-kill-row');
    if (btnKill && !p.is_protected) {
      btnKill.addEventListener('click', (e) => {
        e.stopPropagation();
        killSingleProcess(p.pid, p.name);
      });
    }

    DOM.processTableBody.appendChild(tr);
  });
}

function toggleCross(pid) {
  if (state.crossedPids.has(pid)) {
    state.crossedPids.delete(pid);
  } else {
    state.crossedPids.add(pid);
  }
  updateCrossedUI();
  renderProcessTable();
}

// ============================================================================
// Single Process Killing
// ============================================================================
async function killSingleProcess(pid, name) {
  if (!confirm(`Are you sure you want to terminate process "${name}" (PID ${pid})?`)) {
    return;
  }

  if (state.isDemo) {
    showToast(`[Demo] Terminated "${name}" (PID ${pid}) (Simulated)`, 'success');
    state.crossedPids.delete(pid);
    if (typeof removeDemoProcess === 'function') removeDemoProcess(pid);
    fetchProcesses();
    return;
  }

  try {
    const res = await fetch('/api/processes/kill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid, signal: 'SIGTERM' })
    });
    const result = await res.json();
    if (result.success) {
      showToast(`Terminated "${name}" (PID ${pid})`, 'success');
      state.crossedPids.delete(pid);
      fetchProcesses();
    } else {
      showToast(`Failed: ${result.error}`, 'error');
    }
  } catch (err) {
    showToast(`Error killing process: ${err.message}`, 'error');
  }
}

// ============================================================================
// Modals & Safety Shields
// ============================================================================
function setupModals() {
  // Kill All Active Modal
  DOM.btnCloseKillActiveModal.addEventListener('click', () => DOM.killAllActiveModal.classList.remove('show'));
  DOM.btnCancelKillActiveModal.addEventListener('click', () => DOM.killAllActiveModal.classList.remove('show'));
  DOM.btnConfirmKillAllActive.addEventListener('click', executeKillAllActive);

  // Kill Crossed Modal
  DOM.btnCloseCrossedModal.addEventListener('click', () => DOM.killCrossedModal.classList.remove('show'));
  DOM.btnCancelCrossedModal.addEventListener('click', () => DOM.killCrossedModal.classList.remove('show'));
  DOM.btnConfirmKillCrossed.addEventListener('click', executeKillCrossed);
}

function openKillAllActiveModal() {
  const activeProcs = state.processes.filter(p => p.is_active && !p.is_protected);
  DOM.modalActiveTargetsList.innerHTML = '';

  if (activeProcs.length === 0) {
    DOM.modalActiveTargetsList.innerHTML = `<div class="target-item"><span>No non-protected active user processes detected.</span></div>`;
    DOM.btnConfirmKillAllActive.disabled = true;
  } else {
    DOM.btnConfirmKillAllActive.disabled = false;
    activeProcs.forEach(p => {
      const item = document.createElement('div');
      item.className = 'target-item';
      item.innerHTML = `<span><strong>${p.name}</strong> (PID ${p.pid})</span><span>${p.memory_mb} MB | CPU ${p.cpu_percent}%</span>`;
      DOM.modalActiveTargetsList.appendChild(item);
    });
  }

  DOM.killAllActiveModal.classList.add('show');
}

async function executeKillAllActive() {
  if (state.isDemo) {
    showToast('[Demo] Terminated non-protected active processes (Simulated)', 'success', 3500);
    DOM.killAllActiveModal.classList.remove('show');
    if (typeof removeDemoActiveProcesses === 'function') removeDemoActiveProcesses();
    state.crossedPids.clear();
    fetchProcesses();
    return;
  }

  const selectedSignal = document.querySelector('input[name="killActiveSignal"]:checked')?.value || 'SIGTERM';
  DOM.btnConfirmKillAllActive.disabled = true;
  DOM.btnConfirmKillAllActive.innerHTML = `<span>Terminating...</span>`;

  try {
    const res = await fetch('/api/processes/kill-all-active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signal: selectedSignal, include_other_users: false })
    });
    const result = await res.json();
    DOM.killAllActiveModal.classList.remove('show');

    if (result.success) {
      showToast(`Successfully terminated ${result.killed_count} active processes!`, 'success', 4000);
      state.crossedPids.clear();
      fetchProcesses();
    } else {
      showToast(`Error: ${result.error}`, 'error');
    }
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'error');
  } finally {
    DOM.btnConfirmKillAllActive.disabled = false;
    DOM.btnConfirmKillAllActive.innerHTML = `<span>Terminate Active Processes</span>`;
  }
}

function openKillCrossedModal() {
  const crossedList = state.processes.filter(p => state.crossedPids.has(p.pid));
  DOM.modalCrossedCount.textContent = crossedList.length;
  DOM.modalCrossedTargetsList.innerHTML = '';

  crossedList.forEach(p => {
    const item = document.createElement('div');
    item.className = 'target-item';
    item.innerHTML = `<span><strong>${p.name}</strong> (PID ${p.pid})</span><span>${p.category} | ${p.memory_mb} MB</span>`;
    DOM.modalCrossedTargetsList.appendChild(item);
  });

  DOM.killCrossedModal.classList.add('show');
}

async function executeKillCrossed() {
  const pids = Array.from(state.crossedPids);
  if (pids.length === 0) return;

  if (state.isDemo) {
    showToast(`[Demo] Terminated ${pids.length} crossed process(es) (Simulated)`, 'success');
    if (typeof removeDemoCrossedProcesses === 'function') removeDemoCrossedProcesses(pids);
    state.crossedPids.clear();
    DOM.killCrossedModal.classList.remove('show');
    DOM.btnConfirmKillCrossed.disabled = false;
    DOM.btnConfirmKillCrossed.textContent = 'Terminate Crossed';
    updateCrossedUI();
    fetchProcesses();
    return;
  }

  DOM.btnConfirmKillCrossed.disabled = true;
  DOM.btnConfirmKillCrossed.textContent = 'Terminating...';

  try {
    const res = await fetch('/api/processes/kill-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pids, signal: 'SIGTERM' })
    });
    const result = await res.json();
    DOM.killCrossedModal.classList.remove('show');

    if (result.success) {
      showToast(`Terminated ${result.killed_count} crossed processes!`, 'success');
      state.crossedPids.clear();
      updateCrossedUI();
      fetchProcesses();
    } else {
      showToast(`Batch kill failed: ${result.error}`, 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    DOM.btnConfirmKillCrossed.disabled = false;
    DOM.btnConfirmKillCrossed.textContent = 'Kill Crossed Processes';
  }
}

// Utility: Escape HTML for security
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// 4. RUNNING PROGRAMS & SOFTWARE MANAGER (TAB 4)
// ============================================================================
function setupApplicationControls() {
  // Category Filter Pills
  if (DOM.appFilterBtns) {
    DOM.appFilterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        DOM.appFilterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.appsFilter = btn.dataset.appFilter;
        fetchApplications();
      });
    });
  }

  // Search Input with debounce
  let searchDebounceTimer = null;
  if (DOM.appSearchInput) {
    DOM.appSearchInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      state.appsSearch = val;
      if (DOM.btnClearAppSearch) DOM.btnClearAppSearch.style.display = val ? 'block' : 'none';

      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        fetchApplications();
      }, 250);
    });
  }

  if (DOM.btnClearAppSearch) {
    DOM.btnClearAppSearch.addEventListener('click', () => {
      if (DOM.appSearchInput) DOM.appSearchInput.value = '';
      state.appsSearch = '';
      DOM.btnClearAppSearch.style.display = 'none';
      fetchApplications();
    });
  }

  // Sort Options
  if (DOM.appSortBtns) {
    DOM.appSortBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        DOM.appSortBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.appsSort = btn.dataset.appSort;
        fetchApplications();
      });
    });
  }

  // Expand / Collapse All
  if (DOM.btnExpandAllApps) {
    DOM.btnExpandAllApps.addEventListener('click', () => {
      state.applications.forEach(a => state.expandedAppIds.add(a.app_id));
      renderApplicationsListOnly();
    });
  }

  if (DOM.btnCollapseAllApps) {
    DOM.btnCollapseAllApps.addEventListener('click', () => {
      state.expandedAppIds.clear();
      renderApplicationsListOnly();
    });
  }

  // Kill App Modal Event Listeners
  if (DOM.btnCloseKillAppModal) DOM.btnCloseKillAppModal.addEventListener('click', () => DOM.killAppModal && DOM.killAppModal.classList.remove('show'));
  if (DOM.btnCancelKillAppModal) DOM.btnCancelKillAppModal.addEventListener('click', () => DOM.killAppModal && DOM.killAppModal.classList.remove('show'));
  if (DOM.btnConfirmKillApp) DOM.btnConfirmKillApp.addEventListener('click', confirmKillApp);

  // Uninstall App Modal Event Listeners
  if (DOM.btnCloseUninstallModal) DOM.btnCloseUninstallModal.addEventListener('click', () => DOM.uninstallModal && DOM.uninstallModal.classList.remove('show'));
  if (DOM.btnCloseUninstallDialog) DOM.btnCloseUninstallDialog.addEventListener('click', () => DOM.uninstallModal && DOM.uninstallModal.classList.remove('show'));
  if (DOM.btnCopyUninstallCmd) DOM.btnCopyUninstallCmd.addEventListener('click', copyUninstallCommand);
  if (DOM.btnTogglePwd) DOM.btnTogglePwd.addEventListener('click', togglePasswordVisibility);
  if (DOM.btnSimulateUninstall) DOM.btnSimulateUninstall.addEventListener('click', simulateUninstall);
  if (DOM.btnExecuteUninstall) DOM.btnExecuteUninstall.addEventListener('click', executeUninstall);

  // Delegate click events on the applications list container
  if (DOM.appsListContainer) DOM.appsListContainer.addEventListener('click', handleAppContainerClick);
}

async function fetchApplications(silent = false) {
  if (state.isDemo) {
    renderDemoApplications();
    return;
  }
  // If user is currently typing in the search box, skip background silent update
  if (silent && document.activeElement === DOM.appSearchInput) {
    return;
  }
  // If uninstall modal or kill modal is actively open, avoid background re-render to prevent UI disruption
  if (silent && ((DOM.uninstallModal && DOM.uninstallModal.classList.contains('show')) || 
                 (DOM.killAppModal && DOM.killAppModal.classList.contains('show')))) {
    return;
  }

  try {
    const params = new URLSearchParams({
      category: state.appsFilter,
      q: state.appsSearch,
      sort: state.appsSort
    });
    const res = await fetch(`/api/applications?${params.toString()}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    state.applications = data.applications || [];
    renderApplications(data);
  } catch (err) {
    console.warn('Applications fetch failed:', err);
    if (!state.isDemo && shouldFallbackToDemo()) {
      enableDemoMode();
      renderDemoApplications();
    } else if (!silent && DOM.appsListContainer) {
      DOM.appsListContainer.innerHTML = `<div class="empty-state">Unable to load running applications. Check server connection.</div>`;
    }
  }
}

function renderApplications(data) {
  const summary = data.summary || {};
  const apps = data.applications || [];

  // Update Summary Badges & Cards
  if (DOM.appsCountBadge) DOM.appsCountBadge.textContent = `${summary.total_apps || 0} Apps`;
  if (DOM.appStatTotal) DOM.appStatTotal.textContent = summary.total_apps || 0;
  if (DOM.appStatSubCount) DOM.appStatSubCount.textContent = `${summary.user_apps || 0} user apps · ${summary.daemons || 0} daemons`;
  if (DOM.appStatRam) DOM.appStatRam.textContent = (summary.total_memory_str || '0.0 GB').replace(' GB', '').replace(' MB', 'M');

  // Heaviest App
  if (apps.length > 0) {
    const sortedByMem = [...apps].sort((a, b) => b.total_rss - a.total_rss);
    const heaviest = sortedByMem[0];
    if (DOM.appStatHeaviestName) DOM.appStatHeaviestName.textContent = heaviest.name;
    if (DOM.appStatHeaviestUsage) DOM.appStatHeaviestUsage.textContent = `${heaviest.total_rss_str} (${heaviest.memory_percent}% of RAM)`;

    const sortedByCpu = [...apps].sort((a, b) => b.total_cpu - a.total_cpu);
    const topCpu = sortedByCpu[0];
    if (DOM.appStatTopCpuName) DOM.appStatTopCpuName.textContent = topCpu.name;
    if (DOM.appStatTopCpuUsage) DOM.appStatTopCpuUsage.textContent = `${topCpu.total_cpu}% CPU load`;
  } else {
    if (DOM.appStatHeaviestName) DOM.appStatHeaviestName.textContent = '--';
    if (DOM.appStatHeaviestUsage) DOM.appStatHeaviestUsage.textContent = '-- MB';
    if (DOM.appStatTopCpuName) DOM.appStatTopCpuName.textContent = '--';
    if (DOM.appStatTopCpuUsage) DOM.appStatTopCpuUsage.textContent = '0.0%';
  }

  // Update Filter Pill Badges
  if (DOM.badgeAllApps) DOM.badgeAllApps.textContent = summary.total_apps || 0;
  if (DOM.badgeUserApps) DOM.badgeUserApps.textContent = summary.user_apps || 0;
  if (DOM.badgeHeavyApps) DOM.badgeHeavyApps.textContent = summary.heavy_apps || 0;
  if (DOM.badgeDaemonApps) DOM.badgeDaemonApps.textContent = summary.daemons || 0;

  renderApplicationsListOnly();
}

function renderApplicationsListOnly() {
  const apps = state.applications || [];

  if (apps.length === 0) {
    DOM.appsListContainer.innerHTML = `
      <div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 8px; opacity: 0.5;">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <p>No running software found matching "<strong>${escapeHtml(state.appsSearch || state.appsFilter)}</strong>".</p>
      </div>`;
    return;
  }

  DOM.appsListContainer.innerHTML = apps.map(app => {
    const isExpanded = state.expandedAppIds.has(app.app_id);
    const avatarClass = getAvatarClass(app.icon_hint);
    const avatarEmoji = getAvatarEmoji(app.icon_hint);
    const pkgManagerLabel = (app.package_manager || 'system').toUpperCase();

    // Heavy tag
    const heavyTagHtml = app.is_heavy 
      ? `<span class="badge-heavy-tag" title="Consuming over 400 MB of physical RAM">🔥 Heavy Load: ${app.total_rss_str}</span>` 
      : '';

    // Action buttons
    let uninstallBtnHtml = '';
    if (app.can_uninstall) {
      uninstallBtnHtml = `<button class="btn btn-warning btn-xs" data-action="uninstall-app" data-app-id="${escapeHtml(app.app_id)}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        <span>Uninstall</span>
      </button>`;
    } else if (app.is_protected) {
      uninstallBtnHtml = `<button class="btn btn-secondary btn-xs" disabled title="Essential Ubuntu system component">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <span>Protected</span>
      </button>`;
    } else {
      uninstallBtnHtml = `<button class="btn btn-secondary btn-xs" disabled title="System service or unmanaged binary">System</button>`;
    }

    const killAppBtnHtml = app.is_protected && ['antigravity-ide', 'sys-systemd', 'sys-xorg', 'sys-lightdm', 'shell-bash'].includes(app.app_id)
      ? `<button class="btn btn-secondary btn-xs" disabled title="Protected system process">Protected</button>`
      : `<button class="btn btn-danger btn-xs" data-action="kill-app" data-app-id="${escapeHtml(app.app_id)}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <span>End Software</span>
        </button>`;

    // Sub-processes rows
    const subprocsHtml = (app.processes || []).map(p => {
      const roleClass = getRoleClass(p.role);
      return `
        <tr>
          <td><span class="pid-badge">PID ${p.pid}</span></td>
          <td><span class="role-badge ${roleClass}">${escapeHtml(p.role)}</span></td>
          <td><strong class="${p.cpu_percent > 10 ? 'highlight-rose' : ''}">${p.cpu_percent}%</strong></td>
          <td><strong class="highlight-cyan">${p.memory_mb} MB</strong> <span class="dim-sub">(${p.memory_percent}%)</span></td>
          <td><div class="subproc-cmdline" title="${escapeHtml(p.cmdline_str)}">${escapeHtml(p.cmdline_str)}</div></td>
          <td style="text-align: right;">
            <button class="btn btn-danger btn-xs btn-kill-subproc" data-action="kill-subproc" data-pid="${p.pid}" data-app-id="${escapeHtml(app.app_id)}" title="Terminate only this individual process">
              ✕ Kill Process
            </button>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="app-card ${app.is_heavy ? 'heavy-app' : ''} ${isExpanded ? 'expanded' : ''}" id="app-card-${escapeHtml(app.app_id)}">
        <div class="app-card-main">
          
          <div class="app-identity-col">
            <div class="app-avatar ${avatarClass}">
              <span>${avatarEmoji}</span>
            </div>
            <div class="app-name-wrap">
              <div class="app-title-row">
                <span class="app-title">${escapeHtml(app.name)}</span>
                <span class="app-pkg-badge">${pkgManagerLabel}: ${escapeHtml(app.package_name)}</span>
                ${heavyTagHtml}
              </div>
              <div class="app-meta-row">
                <span><strong>${app.process_count}</strong> process${app.process_count !== 1 ? 'es' : ''}</span>
                <span>·</span>
                <span>Main PID: <code>${app.main_pid}</code></span>
                <span>·</span>
                <span class="meta-user">User: <strong>${escapeHtml(app.user)}</strong></span>
              </div>
            </div>
          </div>

          <div class="app-metrics-col">
            <div class="app-metric-item">
              <span class="app-metric-label">Memory RSS</span>
              <span class="app-metric-value ${app.is_heavy ? 'highlight-rose' : 'highlight-cyan'}">${app.total_rss_str}</span>
              <div class="app-ram-bar-wrap">
                <div class="app-ram-bar-fill ${app.is_heavy ? 'fill-heavy' : ''}" style="width: ${Math.min(100, Math.max(4, app.memory_percent * 3))}%"></div>
              </div>
            </div>

            <div class="app-metric-item">
              <span class="app-metric-label">CPU Load</span>
              <span class="app-metric-value ${app.total_cpu > 15 ? 'highlight-amber' : ''}">${app.total_cpu}%</span>
            </div>

            <div class="app-metric-item">
              <span class="app-metric-label">RAM Share</span>
              <span class="app-metric-value">${app.memory_percent}%</span>
            </div>
          </div>

          <div class="app-actions-col">
            ${killAppBtnHtml}
            <button class="btn btn-outline btn-xs btn-drawer-toggle" data-action="toggle-drawer" data-app-id="${escapeHtml(app.app_id)}">
              <span>Processes (${app.process_count})</span>
              <span class="drawer-chevron">▾</span>
            </button>
            ${uninstallBtnHtml}
          </div>

        </div>

        <!-- Child Processes Accordion Drawer -->
        <div class="app-processes-drawer">
          <div class="drawer-header">
            <span>Sub-processes and threads for <strong>${escapeHtml(app.name)}</strong> (${app.process_count} instances):</span>
            <span class="dim-sub">Click "Kill Process" to end an individual thread/tab without stopping the entire software</span>
          </div>
          <div class="table-responsive">
            <table class="subproc-table">
              <thead>
                <tr>
                  <th style="width: 100px;">PID</th>
                  <th style="width: 190px;">Sub-process Role</th>
                  <th style="width: 90px;">CPU %</th>
                  <th style="width: 140px;">Memory</th>
                  <th>Command Line Arguments</th>
                  <th style="width: 120px; text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${subprocsHtml}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  }).join('');
}

function getAvatarClass(hint) {
  switch (hint) {
    case 'chrome': return 'avatar-chrome';
    case 'code': return 'avatar-code';
    case 'server': return 'avatar-server';
    case 'snap': return 'avatar-snap';
    case 'terminal': return 'avatar-terminal';
    case 'desktop': return 'avatar-desktop';
    case 'system': return 'avatar-system';
    default: return 'avatar-generic';
  }
}

function getAvatarEmoji(hint) {
  switch (hint) {
    case 'chrome': return '🌐';
    case 'code': return '💻';
    case 'server': return '⚡';
    case 'snap': return '📦';
    case 'terminal': return '⌨️';
    case 'desktop': return '🖥️';
    case 'system': return '⚙️';
    default: return '📁';
  }
}

function getRoleClass(role) {
  const r = (role || '').toLowerCase();
  if (r.includes('tab') || r.includes('page') || r.includes('editor')) return 'role-tab';
  if (r.includes('gpu')) return 'role-gpu';
  if (r.includes('network')) return 'role-network';
  if (r.includes('audio')) return 'role-audio';
  if (r.includes('extension')) return 'role-ext';
  if (r.includes('main')) return 'role-main';
  return '';
}

function handleAppContainerClick(e) {
  const actionEl = e.target.closest('[data-action]');
  if (actionEl) {
    const action = actionEl.dataset.action;
    const appId = actionEl.dataset.appId;

    if (action === 'toggle-drawer') {
      toggleAppDrawer(appId);
      return;
    } else if (action === 'kill-app') {
      openKillAppModal(appId);
      return;
    } else if (action === 'kill-subproc') {
      const pid = parseInt(actionEl.dataset.pid, 10);
      killSingleSubproc(pid, appId);
      return;
    } else if (action === 'uninstall-app') {
      openUninstallModal(appId);
      return;
    }
  }

  // Also toggle drawer if clicking anywhere on the app-card header row (not inside a button)
  const cardMain = e.target.closest('.app-card-main');
  if (cardMain && !e.target.closest('button')) {
    const card = cardMain.closest('.app-card');
    if (card && card.id && card.id.startsWith('app-card-')) {
      const appId = card.id.replace('app-card-', '');
      toggleAppDrawer(appId);
    }
  }
}

function toggleAppDrawer(appId) {
  if (state.expandedAppIds.has(appId)) {
    state.expandedAppIds.delete(appId);
  } else {
    state.expandedAppIds.add(appId);
  }
  const card = document.getElementById(`app-card-${appId}`);
  if (card) {
    card.classList.toggle('expanded', state.expandedAppIds.has(appId));
  }
}

// ============================================================================
// End Software Instance Modal & Actions
// ============================================================================
function openKillAppModal(appId) {
  const app = state.applications.find(a => a.app_id === appId);
  if (!app) return;

  state.targetKillApp = app;
  DOM.modalKillAppName.textContent = app.name;
  DOM.modalKillAppProcCount.textContent = app.process_count;
  DOM.modalKillAppRam.textContent = app.total_rss_str;
  DOM.killAppModal.classList.add('show');
}

async function confirmKillApp() {
  if (!state.targetKillApp) return;

  const app = state.targetKillApp;
  const signalInput = document.querySelector('input[name="killAppSignal"]:checked');
  const signal = signalInput ? signalInput.value : 'SIGTERM';

  DOM.btnConfirmKillApp.disabled = true;
  DOM.btnConfirmKillApp.textContent = 'Terminating Software...';

  try {
    const res = await fetch('/api/applications/kill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: app.app_id, signal })
    });
    const result = await res.json();
    DOM.killAppModal.classList.remove('show');

    if (result.success) {
      showToast(result.message || `Terminated all processes of ${app.name}!`, 'success');
      state.expandedAppIds.delete(app.app_id);
      fetchApplications();
      fetchProcesses();
      fetchRam();
    } else {
      showToast(`Termination failed: ${result.error}`, 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    DOM.btnConfirmKillApp.disabled = false;
    DOM.btnConfirmKillApp.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      <span>End Software Instance</span>`;
  }
}

// Kill Single Sub-Process
async function killSingleSubproc(pid, appId) {
  if (!pid) return;

  try {
    const res = await fetch('/api/processes/kill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid, signal: 'SIGTERM' })
    });
    const result = await res.json();
    if (result.success) {
      showToast(`Terminated single process PID ${pid}`, 'success');
      fetchApplications();
      fetchProcesses();
    } else {
      showToast(`Kill PID ${pid} failed: ${result.error}`, 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

// ============================================================================
// Uninstall Software Modal & Execution
// ============================================================================
async function openUninstallModal(appId) {
  const app = state.applications.find(a => a.app_id === appId);
  if (!app) return;

  state.targetUninstallApp = app;

  // Set initial UI details
  DOM.modalUninstallTitle.textContent = app.name;
  DOM.modalUninstallIcon.textContent = getAvatarEmoji(app.icon_hint);
  DOM.modalUninstallPkgManager.textContent = (app.package_manager || 'APT').toUpperCase();
  DOM.modalUninstallPkgName.textContent = app.package_name;
  DOM.modalUninstallVersion.textContent = 'Loading...';
  DOM.modalUninstallSize.textContent = 'Calculating...';
  DOM.modalUninstallDesc.textContent = 'Retrieving package registry data...';
  DOM.modalUninstallProcAlert.textContent = `${app.process_count} running process${app.process_count !== 1 ? 'es' : ''} detected (${app.total_rss_str} RAM).`;

  // Build command snippet
  let cmd = `sudo apt remove --purge -y ${app.package_name}`;
  if (app.package_manager === 'snap') {
    cmd = `sudo snap remove ${app.package_name}`;
  } else if (app.package_manager === 'flatpak') {
    cmd = `sudo flatpak uninstall -y ${app.package_name}`;
  }
  DOM.modalUninstallCmdSnippet.textContent = cmd;

  // Reset console
  DOM.uninstallConsoleWrap.style.display = 'none';
  DOM.uninstallConsoleOutput.textContent = '';
  DOM.copyCmdText.textContent = 'Copy Command';
  if (DOM.sudoPasswordInput && !DOM.sudoPasswordInput.value) {
    DOM.sudoPasswordInput.value = 'anto';
  }

  DOM.uninstallModal.classList.add('show');

  // Fetch package metadata from server
  try {
    const query = new URLSearchParams({
      pkg: app.package_name,
      manager: app.package_manager,
      exe: app.exe || ''
    });
    const res = await fetch(`/api/applications/package-info?${query.toString()}`);
    if (res.ok) {
      const info = await res.json();
      DOM.modalUninstallVersion.textContent = info.version || 'Installed';
      DOM.modalUninstallSize.textContent = info.installed_size || 'Standard';
      DOM.modalUninstallDesc.textContent = info.description || 'System software package';
      if (info.package && info.package !== app.package_name) {
        DOM.modalUninstallPkgName.textContent = info.package;
        let updatedCmd = `sudo apt remove --purge -y ${info.package}`;
        if (app.package_manager === 'snap') updatedCmd = `sudo snap remove ${info.package}`;
        DOM.modalUninstallCmdSnippet.textContent = updatedCmd;
      }
    }
  } catch (err) {
    DOM.modalUninstallVersion.textContent = 'Installed';
    DOM.modalUninstallSize.textContent = 'Standard';
  }
}

function copyUninstallCommand() {
  const cmd = DOM.modalUninstallCmdSnippet.textContent;
  navigator.clipboard.writeText(cmd).then(() => {
    DOM.copyCmdText.textContent = 'Copied!';
    showToast('Terminal uninstallation command copied to clipboard!', 'info');
    setTimeout(() => DOM.copyCmdText.textContent = 'Copy Command', 2500);
  }).catch(() => {
    showToast('Failed to copy to clipboard', 'error');
  });
}

function togglePasswordVisibility() {
  if (DOM.sudoPasswordInput.type === 'password') {
    DOM.sudoPasswordInput.type = 'text';
    DOM.btnTogglePwd.textContent = '🔒';
  } else {
    DOM.sudoPasswordInput.type = 'password';
    DOM.btnTogglePwd.textContent = '👁';
  }
}

async function simulateUninstall() {
  if (!state.targetUninstallApp) return;
  const app = state.targetUninstallApp;
  const pkgName = DOM.modalUninstallPkgName.textContent;
  const pwd = DOM.sudoPasswordInput.value;

  if (state.isDemo) {
    DOM.uninstallConsoleWrap.style.display = 'block';
    DOM.uninstallConsoleStatus.textContent = 'Simulation Complete (Demo Preview)';
    DOM.uninstallConsoleOutput.textContent = `$ sudo apt-get remove -s ${pkgName}\n[Demo Mode] Reading package lists... Done\nBuilding dependency tree... Done\nRemv ${pkgName} [installed]\n\nSimulation succeeded: ${pkgName} can be safely uninstalled. (Preview only)`;
    return;
  }

  DOM.btnSimulateUninstall.disabled = true;
  DOM.btnSimulateUninstall.textContent = 'Simulating...';
  DOM.uninstallConsoleWrap.style.display = 'block';
  DOM.uninstallConsoleStatus.textContent = 'Running simulation test...';
  DOM.uninstallConsoleOutput.textContent = `$ sudo apt-get remove -s ${pkgName}\nConnecting to APT package database...\n`;

  try {
    const res = await fetch('/api/applications/simulate-uninstall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        package_name: pkgName,
        package_manager: app.package_manager,
        password: pwd
      })
    });
    const result = await res.json();
    DOM.uninstallConsoleStatus.textContent = result.success ? 'Simulation Complete (Success)' : 'Simulation Notice';
    DOM.uninstallConsoleOutput.textContent += (result.output || result.error || 'No output recorded');
  } catch (err) {
    DOM.uninstallConsoleStatus.textContent = 'Simulation Error';
    DOM.uninstallConsoleOutput.textContent += `\nError: ${err.message}`;
  } finally {
    DOM.btnSimulateUninstall.disabled = false;
    DOM.btnSimulateUninstall.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      <span>Simulate Removal</span>`;
  }
}

async function executeUninstall() {
  if (!state.targetUninstallApp) return;
  const app = state.targetUninstallApp;
  const pkgName = DOM.modalUninstallPkgName.textContent;
  const pwd = DOM.sudoPasswordInput.value;
  const killFirst = DOM.chkUninstallKillFirst.checked;

  if (state.isDemo) {
    showToast(`[Demo] Uninstallation simulated for "${app.name}"`, 'success');
    DOM.uninstallModal && DOM.uninstallModal.classList.remove('show');
    return;
  }

  if (!confirm(`Are you sure you want to permanently uninstall "${app.name}" (${pkgName}) from Ubuntu?`)) {
    return;
  }

  DOM.btnExecuteUninstall.disabled = true;
  DOM.btnExecuteUninstall.textContent = 'Uninstalling...';
  DOM.uninstallConsoleWrap.style.display = 'block';
  DOM.uninstallConsoleStatus.textContent = 'Uninstalling software...';
  DOM.uninstallConsoleOutput.textContent = `Starting uninstallation for package: ${pkgName}...\n`;

  if (killFirst) {
    DOM.uninstallConsoleOutput.textContent += `Terminating active processes before package removal...\n`;
  }

  try {
    const res = await fetch('/api/applications/uninstall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: app.app_id,
        package_name: pkgName,
        package_manager: app.package_manager,
        password: pwd,
        kill_first: killFirst
      })
    });
    const result = await res.json();
    DOM.uninstallConsoleStatus.textContent = result.success ? 'Uninstalled Successfully' : 'Uninstallation Error';
    DOM.uninstallConsoleOutput.textContent += `\n${result.output || result.error || ''}\n`;

    if (result.success) {
      showToast(result.message || `Successfully uninstalled ${app.name}!`, 'success');
      state.expandedAppIds.delete(app.app_id);
      fetchApplications();
      fetchProcesses();
      fetchRam();
      fetchCondition();
    } else {
      showToast(`Uninstall error: ${result.error}`, 'error');
    }
  } catch (err) {
    DOM.uninstallConsoleStatus.textContent = 'Uninstallation Failed';
    DOM.uninstallConsoleOutput.textContent += `\nExecution Error: ${err.message}`;
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    DOM.btnExecuteUninstall.disabled = false;
    DOM.btnExecuteUninstall.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      <span>Confirm & Uninstall</span>`;
  }
}

// ============================================================================
// DEMO SHOWCASE CONTROLLER (GitHub Pages & Browser Preview)
// ============================================================================

function shouldFallbackToDemo() {
  return window.location.hostname.includes('github.io') || 
         window.location.protocol === 'file:' || 
         window.location.search.includes('demo=true');
}

function enableDemoMode() {
  if (state.isDemo) return;
  state.isDemo = true;
  const banner = document.getElementById('demoBanner');
  if (banner) banner.style.display = 'flex';
  if (DOM.livePill) {
    DOM.livePill.innerHTML = '<span class="live-dot" style="background:#a855f7;box-shadow:0 0 8px #a855f7;"></span><span class="live-status" style="color:#e9d5ff;">DEMO PREVIEW</span>';
    DOM.livePill.title = 'Running in GitHub Pages Demo Mode with simulated Ubuntu telemetry';
  }
}

function checkDemoMode() {
  if (shouldFallbackToDemo()) {
    enableDemoMode();
  }
}

function getDemoConditionData() {
  return {
    system: {
      hostname: 'ubuntu-laptop',
      os_name: 'Ubuntu 24.04 LTS (Noble Numbat)',
      cpu_count: 8,
      uptime_seconds: 24510,
      current_user: 'anto'
    },
    health_score: {
      score: 95,
      grade: 'A',
      color: 'emerald',
      status_text: 'Optimal Hardware Condition',
      summary: 'Thermals cool, memory pressure nominal, battery wear low.'
    },
    battery: {
      present: true,
      percent: 88,
      status: 'Discharging',
      health_percent: 94.5,
      cycle_count: 142,
      design_capacity_wh: 54.0,
      full_capacity_wh: 51.0,
      power_now_w: 12.3,
      voltage_v: 11.55,
      time_remaining: '3h 40m'
    },
    thermals: {
      cpu_temp: 47.8,
      status: 'Optimal',
      zones: [
        { label: 'CPU Package', temp: 48 },
        { label: 'Core 0', temp: 46 },
        { label: 'Core 1', temp: 47 },
        { label: 'Core 2', temp: 45 },
        { label: 'NVMe Drive', temp: 41 }
      ]
    },
    storage: [
      { mount: '/', filesystem: '/dev/nvme0n1p2', total_gb: 512.0, used_gb: 198.4, free_gb: 288.6, percent: 38.8 },
      { mount: '/boot/efi', filesystem: '/dev/nvme0n1p1', total_gb: 1.0, used_gb: 0.1, free_gb: 0.9, percent: 10.0 }
    ],
    issues: [
      { level: 'info', title: 'Thermals Nominal', message: 'No thermal throttling detected across all ACPI zones.', resolved: true },
      { level: 'info', title: 'Battery Degradation Safe', message: 'Battery health is at 94.5% of design capacity.', resolved: true },
      { level: 'warning', title: 'RAM Allocation Tip', message: 'Several background browser renderer processes consuming inactive cache.', resolved: false }
    ]
  };
}

let demoTimeStep = 0;
function getDemoRamData() {
  demoTimeStep++;
  const baseUsed = 6.4 + Math.sin(demoTimeStep * 0.2) * 0.5 + (Math.random() * 0.15);
  const total = 16.0;
  const avail = total - baseUsed;
  const cached = 3.2;
  const buffers = 0.6;
  const free = avail - cached - buffers;
  const percent = Math.round((baseUsed / total) * 100);

  // Maintain smooth rolling 30-sample history
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  
  if (!state.demoHistory) {
    state.demoHistory = [];
    for (let i = 25; i >= 0; i--) {
      const past = new Date(Date.now() - i * 2000);
      const pastTime = past.toTimeString().split(' ')[0];
      const pastUsed = 6.2 + Math.sin((demoTimeStep - i) * 0.2) * 0.4;
      state.demoHistory.push({
        time: pastTime,
        used_gb: parseFloat(pastUsed.toFixed(2)),
        available_gb: parseFloat((total - pastUsed).toFixed(2))
      });
    }
  }

  state.demoHistory.push({
    time: timeStr,
    used_gb: parseFloat(baseUsed.toFixed(2)),
    available_gb: parseFloat(avail.toFixed(2))
  });

  if (state.demoHistory.length > 30) {
    state.demoHistory.shift();
  }

  return {
    ram: {
      total: total * 1024 * 1024 * 1024,
      total_gb: total.toFixed(1),
      used: baseUsed * 1024 * 1024 * 1024,
      used_gb: baseUsed.toFixed(2),
      used_str: `${baseUsed.toFixed(2)} GB`,
      available: avail * 1024 * 1024 * 1024,
      available_gb: avail.toFixed(2),
      available_str: `${avail.toFixed(2)} GB`,
      cached: cached * 1024 * 1024 * 1024,
      cached_gb: cached.toFixed(1),
      buffers: buffers * 1024 * 1024 * 1024,
      buffers_gb: buffers.toFixed(1),
      free: Math.max(0.1, free) * 1024 * 1024 * 1024,
      free_str: `${Math.max(0.1, free).toFixed(2)} GB`,
      shared: 256 * 1024 * 1024,
      percent: percent
    },
    swap: {
      total: 8.0 * 1024 * 1024 * 1024,
      total_gb: '8.0',
      used: 0.35 * 1024 * 1024 * 1024,
      used_gb: '0.35',
      used_str: '358 MB',
      free: 7.65 * 1024 * 1024 * 1024,
      percent: 4.4
    },
    pressure: {
      some: { avg10: 0.0, avg60: 0.0, avg300: 0.0, total: 1200 },
      full: { avg10: 0.0, avg60: 0.0, avg300: 0.0, total: 0 }
    },
    history: state.demoHistory
  };
}

let demoProcessStore = [
  { pid: 1420, name: 'code', cmdline: '/usr/share/code/code .', username: 'anto', cpu_percent: 6.2, memory_percent: 5.2, memory_rss_mb: 840.2, memory_mb: 840.2, is_active: true, is_protected: false, category: 'active', status: 'running', num_threads: 34, create_time: '18:10' },
  { pid: 1892, name: 'chrome', cmdline: '/opt/google/chrome/chrome --type=renderer', username: 'anto', cpu_percent: 4.8, memory_percent: 4.1, memory_rss_mb: 660.1, memory_mb: 660.1, is_active: true, is_protected: false, category: 'active', status: 'running', num_threads: 24, create_time: '18:12' },
  { pid: 1950, name: 'chrome-gpu', cmdline: '/opt/google/chrome/chrome --type=gpu-process', username: 'anto', cpu_percent: 2.1, memory_percent: 2.4, memory_rss_mb: 388.5, memory_mb: 388.5, is_active: true, is_protected: false, category: 'active', status: 'running', num_threads: 16, create_time: '18:12' },
  { pid: 2105, name: 'gnome-terminal', cmdline: 'gnome-terminal-server', username: 'anto', cpu_percent: 0.9, memory_percent: 1.1, memory_rss_mb: 178.4, memory_mb: 178.4, is_active: true, is_protected: false, category: 'active', status: 'running', num_threads: 8, create_time: '18:20' },
  { pid: 2410, name: 'python3', cmdline: 'python3 server.py', username: 'anto', cpu_percent: 0.8, memory_percent: 0.7, memory_rss_mb: 112.4, memory_mb: 112.4, is_active: true, is_protected: true, category: 'active', status: 'running', num_threads: 6, create_time: '18:30' },
  { pid: 2680, name: 'bash', cmdline: '/bin/bash', username: 'anto', cpu_percent: 0.1, memory_percent: 0.2, memory_rss_mb: 32.1, memory_mb: 32.1, is_active: true, is_protected: false, category: 'active', status: 'sleeping', num_threads: 1, create_time: '18:25' },
  { pid: 1105, name: 'gnome-shell', cmdline: '/usr/bin/gnome-shell', username: 'anto', cpu_percent: 3.1, memory_percent: 3.2, memory_rss_mb: 512.6, memory_mb: 512.6, is_active: true, is_protected: true, category: 'active', status: 'running', num_threads: 20, create_time: '17:30' },
  { pid: 1, name: 'systemd', cmdline: '/sbin/init', username: 'root', cpu_percent: 0.0, memory_percent: 0.1, memory_rss_mb: 16.8, memory_mb: 16.8, is_active: false, is_protected: true, category: 'background', status: 'sleeping', num_threads: 1, create_time: '17:28' },
  { pid: 842, name: 'systemd-journald', cmdline: '/lib/systemd/systemd-journald', username: 'root', cpu_percent: 0.0, memory_percent: 0.2, memory_rss_mb: 28.5, memory_mb: 28.5, is_active: false, is_protected: true, category: 'background', status: 'sleeping', num_threads: 1, create_time: '17:29' },
  { pid: 914, name: 'NetworkManager', cmdline: '/usr/sbin/NetworkManager', username: 'root', cpu_percent: 0.0, memory_percent: 0.1, memory_rss_mb: 22.3, memory_mb: 22.3, is_active: false, is_protected: true, category: 'background', status: 'sleeping', num_threads: 3, create_time: '17:29' },
  { pid: 980, name: 'dockerd', cmdline: '/usr/bin/dockerd -H fd://', username: 'root', cpu_percent: 0.2, memory_percent: 0.6, memory_rss_mb: 96.0, memory_mb: 96.0, is_active: false, is_protected: false, category: 'background', status: 'sleeping', num_threads: 12, create_time: '17:29' },
  { pid: 1045, name: 'containerd', cmdline: '/usr/bin/containerd', username: 'root', cpu_percent: 0.1, memory_percent: 0.3, memory_rss_mb: 48.2, memory_mb: 48.2, is_active: false, is_protected: false, category: 'background', status: 'sleeping', num_threads: 8, create_time: '17:29' }
];

function removeDemoProcess(pid) {
  demoProcessStore = demoProcessStore.filter(p => p.pid !== pid);
}

function removeDemoActiveProcesses() {
  demoProcessStore = demoProcessStore.filter(p => !p.is_active || p.is_protected);
}

function removeDemoCrossedProcesses(pids) {
  const pidSet = new Set(pids);
  demoProcessStore = demoProcessStore.filter(p => !pidSet.has(p.pid));
}

function renderDemoProcesses() {
  let list = [...demoProcessStore];
  
  if (state.processCategory === 'active') {
    list = list.filter(p => p.is_active);
  } else if (state.processCategory === 'background') {
    list = list.filter(p => !p.is_active);
  }

  if (state.processUser === 'me') {
    list = list.filter(p => p.username === state.currentUser);
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(q) || p.cmdline.toLowerCase().includes(q) || String(p.pid).includes(q));
  }

  const activeCount = demoProcessStore.filter(p => p.is_active).length;
  const bgCount = demoProcessStore.filter(p => !p.is_active).length;

  DOM.badgeAllProcs.textContent = demoProcessStore.length;
  DOM.badgeActiveProcs.textContent = activeCount;
  DOM.badgeBgProcs.textContent = bgCount;
  DOM.activeProcsCountBadge.textContent = `${activeCount} Active`;

  state.processes = list;
  renderProcessTable();
  updateCrossedUI();
}

function renderDemoApplications() {
  const applications = [
    {
      app_id: 'code',
      name: 'Visual Studio Code',
      icon: '💻',
      category: 'Development',
      memory_mb: 840.2,
      memory_str: '840.2 MB',
      memory_percent: 5.2,
      cpu_percent: 6.2,
      process_count: 5,
      pids: [1420, 1425, 1430, 1435, 1440],
      package_manager: 'apt',
      package_type: 'deb',
      package_name: 'code',
      is_daemon: false,
      is_running: true
    },
    {
      app_id: 'google-chrome',
      name: 'Google Chrome',
      icon: '🌐',
      category: 'Internet',
      memory_mb: 1048.6,
      memory_str: '1.05 GB',
      memory_percent: 6.5,
      cpu_percent: 6.9,
      process_count: 8,
      pids: [1892, 1950, 1955, 1960, 1965],
      package_manager: 'apt',
      package_type: 'deb',
      package_name: 'google-chrome-stable',
      is_daemon: false,
      is_running: true
    },
    {
      app_id: 'gnome-terminal',
      name: 'Terminal',
      icon: '⌨️',
      category: 'System',
      memory_mb: 210.5,
      memory_str: '210.5 MB',
      memory_percent: 1.3,
      cpu_percent: 1.0,
      process_count: 2,
      pids: [2105, 2680],
      package_manager: 'apt',
      package_type: 'deb',
      package_name: 'gnome-terminal',
      is_daemon: false,
      is_running: true
    },
    {
      app_id: 'docker',
      name: 'Docker Daemon & Containers',
      icon: '🐳',
      category: 'Infrastructure',
      memory_mb: 144.2,
      memory_str: '144.2 MB',
      memory_percent: 0.9,
      cpu_percent: 0.3,
      process_count: 3,
      pids: [980, 1045],
      package_manager: 'apt',
      package_type: 'deb',
      package_name: 'docker.io',
      is_daemon: true,
      is_running: true
    }
  ];

  let filtered = applications;
  if (state.appsFilter === 'user') {
    filtered = filtered.filter(a => !a.is_daemon);
  } else if (state.appsFilter === 'daemon') {
    filtered = filtered.filter(a => a.is_daemon);
  }

  if (state.appsSearch) {
    const q = state.appsSearch.toLowerCase();
    filtered = filtered.filter(a => a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q));
  }

  const data = {
    summary: {
      total_apps: applications.length,
      user_apps: 3,
      daemons: 1,
      total_memory_mb: 2243.5,
      total_cpu_percent: 14.4
    },
    applications: filtered
  };

  state.applications = data.applications;
  renderApplications(data);
}


