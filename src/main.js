/** 薪酬結構設計平台 — 單頁儀表板 */

import { signInWithGoogle, signOut, onAuthChange, getCurrentUser } from './auth.js';
import { INDUSTRIES, DEPT_TYPE, DEPT_RATIOS, DEPT_SUBJECTS, INDUSTRY_BENCHMARKS, ONE_LINERS, createDeptConfig, ALL_DEPTS } from './data.js';

let currentUser = null;
let selectedIndustry = null;
let selectedDepts = [];
let deptConfigs = {};

onAuthChange((event, user) => {
  if (user) {
    currentUser = user;
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('userName').textContent = user.user_metadata?.full_name || user.email;
    document.getElementById('userAvatar').src = user.user_metadata?.avatar_url || '';
    initApp();
  } else { currentUser = null; }
});

getCurrentUser().then(user => {
  if (user) {
    currentUser = user;
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('userName').textContent = user.user_metadata?.full_name || user.email;
    document.getElementById('userAvatar').src = user.user_metadata?.avatar_url || '';
    initApp();
  }
});

window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;

function initApp() {
  renderIndustries();
  updateDepts();
}

// ── Industry Chips ──
function renderIndustries() {
  document.getElementById('industryChips').innerHTML =
    Object.keys(INDUSTRIES).map(ind =>
      `<button class="chip ${selectedIndustry === ind ? 'active' : ''}" onclick="window.pickIndustry('${ind}')">${ind}</button>`
    ).join('');
}

window.pickIndustry = function(ind) {
  selectedIndustry = ind;
  renderIndustries();
  selectedDepts = [...INDUSTRIES[ind]];
  deptConfigs = {};
  updateDepts();
};

// ── Department Cards ──
function updateDepts() {
  const container = document.getElementById('deptCards');
  const depts = selectedIndustry ? INDUSTRIES[selectedIndustry] : ALL_DEPTS;

  if (!selectedIndustry) {
    container.innerHTML = `<div class="empty">← 請先選擇產業</div>`;
    updateSummary();
    return;
  }

  container.innerHTML = depts.map(d => {
    const type = DEPT_TYPE[d];
    const tClass = type === '上山型' ? 'up' : type === '平路型' ? 'flat' : 'down';
    const checked = selectedDepts.includes(d);
    const r = DEPT_RATIOS[d];
    const cfg = deptConfigs[d];
    const ac = cfg ? cfg.annualTotal : 600000;
    const fc = cfg ? cfg.fixedAnnual : Math.round(600000 * r.fixed / 100);
    const mb = cfg ? cfg.monthlyBase : Math.round(fc / 12);
    const bc = cfg ? cfg.behaviorAnnual : Math.round(600000 * r.behavior / 100);
    const pc = cfg ? cfg.perfAnnual : Math.round(600000 * r.performance / 100);

    return `<div class="d-card ${checked ? 'on' : 'off'}" id="card-${d}">
      <div class="d-head" onclick="window.toggleDept('${d}')">
        <input type="checkbox" ${checked ? 'checked' : ''} onclick="event.stopPropagation();window.toggleDept('${d}')">
        <span class="d-name">${d}</span>
        <span class="d-type ${tClass}">${type}</span>
        <span class="d-desc">${r.desc}</span>
        <span class="d-one">${ONE_LINERS[d] || ''}</span>
      </div>
      <div class="d-body ${checked ? '' : 'hidden'}">
        <div class="d-row">
          <div class="d-field"><label>年薪總包</label><input type="number" value="${ac}" min="200000" max="5000000" step="10000" oninput="window.updCfg('${d}','total',this.value)"></div>
          <div class="d-ratios">
            <div class="d-ratio"><label>固定 ${r.fixed}%</label><span>NT$ ${fc.toLocaleString()}</span><span class="sub">月 ${mb.toLocaleString()}</span></div>
            <div class="d-ratio"><label>行為 ${r.behavior}%</label><span>NT$ ${bc.toLocaleString()}</span></div>
            <div class="d-ratio"><label>績效 ${r.performance}%</label><span>NT$ ${pc.toLocaleString()}</span></div>
          </div>
        </div>
        <div class="d-subj">
          <div class="d-subj-group"><strong>基本資格</strong>${DEPT_SUBJECTS[d].base.map(s => `<span>${s}</span>`).join('')}</div>
          <div class="d-subj-group"><strong>行為獎金</strong>${DEPT_SUBJECTS[d].behavior.map(s => `<span>${s}</span>`).join('')}</div>
          <div class="d-subj-group"><strong>績效獎金</strong>${DEPT_SUBJECTS[d].performance.map(s => `<span>${s}</span>`).join('')}</div>
          <div class="d-subj-group"><strong>分紅</strong>${DEPT_SUBJECTS[d].bonus.map(s => `<span>${s}</span>`).join('')}</div>
          <div class="d-subj-group"><strong>福利</strong>${DEPT_SUBJECTS[d].welfare.map(s => `<span>${s}</span>`).join('')}</div>
          <div class="d-subj-group"><span style="color:#e74c3c;">風險</span>${DEPT_SUBJECTS[d].risks.map(s => `<span>${s}</span>`).join('')}</div>
        </div>
      </div>
    </div>`;
  }).join('');
  updateSummary();
}

window.toggleDept = function(d) {
  const idx = selectedDepts.indexOf(d);
  if (idx >= 0) {
    selectedDepts.splice(idx, 1);
    delete deptConfigs[d];
  } else {
    selectedDepts.push(d);
    if (!deptConfigs[d]) deptConfigs[d] = createDeptConfig(d, 600000);
  }
  updateDepts();
};

window.updCfg = function(d, field, value) {
  if (!deptConfigs[d]) deptConfigs[d] = createDeptConfig(d, parseInt(value) || 600000);
  const cfg = deptConfigs[d];
  if (field === 'total') {
    cfg.annualTotal = parseInt(value) || 600000;
    cfg.fixedAnnual = Math.round(cfg.annualTotal * cfg.fixedRatio / 100);
    cfg.behaviorAnnual = Math.round(cfg.annualTotal * cfg.behaviorRatio / 100);
    cfg.perfAnnual = Math.round(cfg.annualTotal * cfg.performanceRatio / 100);
    cfg.monthlyBase = Math.round(cfg.fixedAnnual / 12);
  }
  updateDepts();
};

// ── Summary ──
function updateSummary() {
  const container = document.getElementById('summaryContent');
  const active = selectedDepts.filter(d => deptConfigs[d]);
  if (active.length === 0) {
    container.innerHTML = '<div class="empty">勾選部門後這裡會顯示彙總</div>';
    document.getElementById('benchmark').innerHTML = '';
    return;
  }

  let totalF = 0, totalB = 0, totalP = 0;
  let rows = active.map(d => {
    const cfg = deptConfigs[d];
    const type = DEPT_TYPE[d];
    const tc = type === '上山型' ? 'up' : type === '平路型' ? 'flat' : 'down';
    totalF += cfg.fixedAnnual;
    totalB += cfg.behaviorAnnual;
    totalP += cfg.perfAnnual;
    return `<tr class="t-${tc}"><td><strong>${d}</strong></td><td><span class="d-type ${tc}" style="font-size:10px;">${type}</span></td>
      <td class="r">NT$ ${cfg.monthlyBase.toLocaleString()}</td>
      <td class="r">NT$ ${cfg.fixedAnnual.toLocaleString()}</td>
      <td class="r">NT$ ${cfg.behaviorAnnual.toLocaleString()}</td>
      <td class="r">NT$ ${cfg.perfAnnual.toLocaleString()}</td>
      <td class="r"><strong>NT$ ${cfg.annualTotal.toLocaleString()}</strong></td>
      <td class="r">${cfg.fixedRatio}:${cfg.behaviorRatio + cfg.performanceRatio}</td></tr>`;
  }).join('');

  const grand = totalF + totalB + totalP;
  container.innerHTML = `<table class="stbl"><thead><tr><th>部門</th><th>型</th><th class="r">月固定</th><th class="r">年固定</th><th class="r">行為</th><th class="r">績效</th><th class="r">年薪總包</th><th class="r">固:浮</th></tr></thead>
    <tbody>${rows}
    <tr class="t-total"><td><strong>合計</strong></td><td></td><td class="r">NT$ ${Math.round(grand/12).toLocaleString()}</td>
      <td class="r"><strong>NT$ ${totalF.toLocaleString()}</strong></td>
      <td class="r"><strong>NT$ ${totalB.toLocaleString()}</strong></td>
      <td class="r"><strong>NT$ ${totalP.toLocaleString()}</strong></td>
      <td class="r"><strong>NT$ ${grand.toLocaleString()}</strong></td>
      <td class="r"><strong>${Math.round(totalF/grand*100)}:${Math.round((totalB+totalP)/grand*100)}</strong></td></tr>
    </tbody></table>`;

  // Industry benchmark
  const bench = INDUSTRY_BENCHMARKS[selectedIndustry];
  if (bench) {
    document.getElementById('benchmark').innerHTML =
      `<div class="bm"><span>${selectedIndustry}</span> 建議人事成本 <strong>${bench.laborRate}</strong> ｜ 毛利率參考 <strong>${bench.grossMargin}</strong></div>`;
  }
}

// ── Export ──
window.exportCSV = function() {
  const active = selectedDepts.filter(d => deptConfigs[d]);
  let csv = '\uFEFF部門,類型,月固定薪,年固定,行為獎金,績效獎金,年薪總包,固定%,浮動%\n';
  active.forEach(d => {
    const cfg = deptConfigs[d];
    csv += `${d},${DEPT_TYPE[d]},${cfg.monthlyBase},${cfg.fixedAnnual},${cfg.behaviorAnnual},${cfg.perfAnnual},${cfg.annualTotal},${cfg.fixedRatio},${cfg.behaviorRatio + cfg.performanceRatio}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `薪酬結構_${selectedIndustry || '未命名'}.csv`;
  a.click();
};

window.exportPDF = function() { window.print(); };
