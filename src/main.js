import { signInWithGoogle, signOut, onAuthChange, getCurrentUser } from './auth.js';
import { INDUSTRIES, DEPT_TYPE, DEPT_RATIOS, DEPT_SUBJECTS, INDUSTRY_BENCHMARKS, ONE_LINERS, TYPE_DESCRIPTIONS, createDeptConfig, ALL_DEPTS } from './data.js';

// ── State ──
let currentUser = null;
let selectedIndustry = null;
let selectedDepts = [];
let deptConfigs = {};

// ── Auth ──
onAuthChange((event, user) => {
  if (user) {
    currentUser = user;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('userName').textContent = user.user_metadata?.full_name || user.email;
    document.getElementById('userAvatar').src = user.user_metadata?.avatar_url || '';
    initApp();
  } else {
    currentUser = null;
  }
});

getCurrentUser().then(user => {
  if (user) {
    currentUser = user;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('userName').textContent = user.user_metadata?.full_name || user.email;
    document.getElementById('userAvatar').src = user.user_metadata?.avatar_url || '';
    initApp();
  }
});

window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;

function initApp() {
  renderIndustryStep();
}

// ── Step Navigation ──
window.goStep = function(n) {
  document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
  document.getElementById(`step${n}`).classList.remove('hidden');
  document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
  document.querySelector(`.step[data-step="${n}"]`).classList.add('active');
  document.querySelectorAll('.step').forEach(el => {
    el.classList.toggle('done', parseInt(el.dataset.step) < n);
  });
  if (n === 3) renderConfigStep();
  if (n === 4) renderOverviewStep();
};

// ── Step 1: Industry ──
function renderIndustryStep() {
  const grid = document.getElementById('industryGrid');
  grid.innerHTML = Object.keys(INDUSTRIES).map(ind =>
    `<div class="industry-card ${selectedIndustry === ind ? 'selected' : ''}" onclick="window.selectIndustry('${ind}')">
      <div class="name">${ind}</div>
      <div class="count">${INDUSTRIES[ind].length} 個部門</div>
    </div>`
  ).join('');
}

window.selectIndustry = function(ind) {
  selectedIndustry = ind;
  document.querySelectorAll('.industry-card').forEach(el => el.classList.toggle('selected', el.textContent.trim().startsWith(ind)));
  selectedDepts = [...INDUSTRIES[ind]];
  deptConfigs = {};
  renderDeptStep();
  goStep(2);
};

// ── Step 2: Departments ──
function renderDeptStep() {
  const list = document.getElementById('deptChecklist');
  const depts = selectedIndustry ? INDUSTRIES[selectedIndustry] : ALL_DEPTS;
  list.innerHTML = depts.map(d => {
    const type = DEPT_TYPE[d];
    const typeClass = type === '上山型' ? 'up' : type === '平路型' ? 'flat' : 'down';
    const checked = selectedDepts.includes(d);
    const r = DEPT_RATIOS[d];
    return `<div class="dept-check-item ${checked ? 'checked' : ''}" onclick="window.toggleDept('${d}')">
      <input type="checkbox" ${checked ? 'checked' : ''}>
      <div><strong>${d}</strong><br><span style="font-size:11px;color:#888;">${r.desc} | ${r.fixed}:${r.behavior+ r.performance} 固:浮</span></div>
      <span class="dtype ${typeClass}">${type}</span>
    </div>`;
  }).join('');
}

window.toggleDept = function(d) {
  const idx = selectedDepts.indexOf(d);
  if (idx >= 0) selectedDepts.splice(idx, 1);
  else selectedDepts.push(d);
  renderDeptStep();
};

// ── Step 3: Configure ──
function renderConfigStep() {
  const container = document.getElementById('deptConfigList');
  selectedDepts.forEach(d => {
    if (!deptConfigs[d]) {
      deptConfigs[d] = createDeptConfig(d, 600000);
    }
  });
  container.innerHTML = selectedDepts.map(d => {
    const cfg = deptConfigs[d];
    if (!cfg) return '';
    const r = DEPT_RATIOS[d];
    const subj = DEPT_SUBJECTS[d];
    return `<div class="dept-config" id="cfg-${d}">
      <div class="dh">
        <h3>${d}</h3>
        <span class="dtype ${cfg.type === '上山型' ? 'up' : cfg.type === '平路型' ? 'flat' : 'down'} tag">${cfg.type}</span>
        <span style="font-size:11px;color:#888;margin-left:auto;">${ONE_LINERS[d] || ''}</span>
      </div>
      <div class="sliders">
        <div class="slider-group">
          <label>年薪總包</label>
          <input type="range" min="300000" max="2000000" step="10000" value="${cfg.annualTotal}" oninput="window.updateConfig('${d}','annualTotal',this.value)">
          <div class="val">NT$ ${Math.round(cfg.annualTotal).toLocaleString()}</div>
        </div>
      </div>
      <div style="display:flex;gap:16px;margin-bottom:12px;font-size:13px;">
        <div><strong>固定 ${cfg.fixedRatio}%</strong> <span style="color:#666;">NT$ ${cfg.fixedAnnual.toLocaleString()}/年 (月 ${cfg.monthlyBase.toLocaleString()})</span></div>
        <div><strong>行為 ${cfg.behaviorRatio}%</strong> <span style="color:#666;">NT$ ${cfg.behaviorAnnual.toLocaleString()}/年</span></div>
        <div><strong>績效 ${cfg.performanceRatio}%</strong> <span style="color:#666;">NT$ ${cfg.perfAnnual.toLocaleString()}/年</span></div>
      </div>
      <div class="subj">
        <div><strong>基本資格</strong><ul>${subj.base.map(s => `<li>${s}</li>`).join('')}</ul></div>
        <div><strong>行為獎金</strong><ul>${subj.behavior.map(s => `<li>${s}</li>`).join('')}</ul></div>
        <div><strong>績效獎金</strong><ul>${subj.performance.map(s => `<li>${s}</li>`).join('')}</ul></div>
        <div><strong>公司分紅</strong><ul>${subj.bonus.map(s => `<li>${s}</li>`).join('')}</ul></div>
        <div><strong>其他福利</strong><ul>${subj.welfare.map(s => `<li>${s}</li>`).join('')}</ul></div>
        <div><strong>風險條件</strong><ul>${subj.risks.map(s => `<li>${s}</li>`).join('')}</ul></div>
      </div>
    </div>`;
  }).join('');
}

window.updateConfig = function(dept, field, value) {
  if (!deptConfigs[dept]) return;
  const cfg = deptConfigs[dept];
  if (field === 'annualTotal') {
    cfg.annualTotal = parseInt(value);
    cfg.fixedAnnual = Math.round(cfg.annualTotal * cfg.fixedRatio / 100);
    cfg.behaviorAnnual = Math.round(cfg.annualTotal * cfg.behaviorRatio / 100);
    cfg.perfAnnual = Math.round(cfg.annualTotal * cfg.performanceRatio / 100);
    cfg.monthlyBase = Math.round(cfg.fixedAnnual / 12);
  }
  renderConfigStep();
};

// ── Step 4: Overview ──
function renderOverviewStep() {
  const container = document.getElementById('overviewContent');
  const selected = selectedDepts.filter(d => deptConfigs[d] && deptConfigs[d].annualTotal > 0);
  if (selected.length === 0) {
    container.innerHTML = '<div class="card"><p style="color:#888;">請先設定至少一個部門</p></div>';
    return;
  }
  let totalFixed = 0, totalBehavior = 0, totalPerf = 0, totalBonus = 0;
  let industryBench = INDUSTRY_BENCHMARKS[selectedIndustry] || { laborRate: '—', grossMargin: '—' };

  let html = `<div class="card">
    <div style="display:flex;gap:16px;margin-bottom:12px;font-size:12px;color:#666;">
      <span>產業：<strong>${selectedIndustry || '未選取'}</strong></span>
      <span>建議人事成本：<strong>${industryBench.laborRate}</strong></span>
      <span>毛利率參考：<strong>${industryBench.grossMargin}</strong></span>
    </div>
    <table class="overview-table">
      <thead><tr><th>部門</th><th>型</th><th>月固定薪</th><th class="r">年固定</th><th class="r">行為獎金</th><th class="r">績效獎金</th><th class="r">總浮動</th><th class="r">年薪總包</th><th class="r">固:浮</th></tr></thead><tbody>`;

  selected.forEach(d => {
    const cfg = deptConfigs[d];
    const type = DEPT_TYPE[d];
    const typeClass = type === '上山型' ? 'up' : type === '平路型' ? 'flat' : 'down';
    const typeRow = type === '上山型' ? 'type-up' : type === '平路型' ? 'type-flat' : 'type-down';
    const totalFloat = cfg.behaviorAnnual + cfg.perfAnnual;
    totalFixed += cfg.fixedAnnual;
    totalBehavior += cfg.behaviorAnnual;
    totalPerf += cfg.perfAnnual;
    totalBonus += totalFloat;
    html += `<tr class="${typeRow}">
      <td><strong>${d}</strong></td>
      <td><span class="dtype ${typeClass}" style="font-size:10px;">${type}</span></td>
      <td>NT$ ${cfg.monthlyBase.toLocaleString()}</td>
      <td class="r">NT$ ${cfg.fixedAnnual.toLocaleString()}</td>
      <td class="r">NT$ ${cfg.behaviorAnnual.toLocaleString()}</td>
      <td class="r">NT$ ${cfg.perfAnnual.toLocaleString()}</td>
      <td class="r">NT$ ${totalFloat.toLocaleString()}</td>
      <td class="r"><strong>NT$ ${cfg.annualTotal.toLocaleString()}</strong></td>
      <td class="r">${cfg.fixedRatio}:${cfg.behaviorRatio + cfg.performanceRatio}</td>
    </tr>`;
  });

  const grandTotal = totalFixed + totalBehavior + totalPerf;
  html += `<tr class="total">
    <td><strong>合計</strong></td><td></td><td></td>
    <td class="r"><strong>NT$ ${totalFixed.toLocaleString()}</strong></td>
    <td class="r"><strong>NT$ ${totalBehavior.toLocaleString()}</strong></td>
    <td class="r"><strong>NT$ ${totalPerf.toLocaleString()}</strong></td>
    <td class="r"><strong>NT$ ${totalBonus.toLocaleString()}</strong></td>
    <td class="r"><strong>NT$ ${grandTotal.toLocaleString()}</strong></td>
    <td class="r"><strong>${Math.round(totalFixed/grandTotal*100)}:${Math.round(totalBonus/grandTotal*100)}</strong></td>
  </tr>`;
  html += '</tbody></table></div>';

  // One-liner principles
  html += '<div class="card"><h3>部門薪酬設計原則</h3>';
  selected.forEach(d => {
    html += `<div style="padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px;"><strong>${d}</strong>：${ONE_LINERS[d] || ''}</div>`;
  });
  html += '</div>';

  // Industry benchmark context
  html += `<div class="card"><h3>產業對照</h3>
    <div style="font-size:13px;color:#555;line-height:1.8;">
      <p>${selectedIndustry || '所選產業'} 合理人事成本佔營收比例：<strong>${industryBench.laborRate}</strong></p>
      <p>你當前 ${selected.length} 個部門年薪總包：<strong>NT$ ${grandTotal.toLocaleString()}</strong></p>
      <p style="font-size:11px;color:#999;">以上為建議參考值，實際需依公司營收規模與獲利狀況調整</p>
    </div></div>`;

  container.innerHTML = html;
}

// ── Export ──
window.exportCSV = function() {
  const selected = selectedDepts.filter(d => deptConfigs[d]);
  let csv = '\uFEFF部門,類型,月固定薪,年固定薪,行為獎金,績效獎金,年薪總包,固定%,浮動%\n';
  selected.forEach(d => {
    const cfg = deptConfigs[d];
    const type = DEPT_TYPE[d];
    const totalFloat = cfg.behaviorAnnual + cfg.perfAnnual;
    csv += `${d},${type},${cfg.monthlyBase},${cfg.fixedAnnual},${cfg.behaviorAnnual},${cfg.perfAnnual},${cfg.annualTotal},${cfg.fixedRatio},${cfg.behaviorRatio + cfg.performanceRatio}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `薪酬結構_${selectedIndustry || '未命名'}.csv`;
  link.click();
};

window.exportPDF = function() {
  window.print();
};
