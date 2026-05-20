/** 薪酬結構設計平台 — 單頁儀表板 */

import { signInWithGoogle, signOut, onAuthChange, getCurrentUser } from './auth.js';
import { INDUSTRIES, DEPT_TYPE, DEPT_RATIOS, DEPT_SUBJECTS, INDUSTRY_BENCHMARKS, ONE_LINERS, createDeptConfig, ALL_DEPTS } from './data.js';

let currentUser = null;
let selectedIndustry = null;
let selectedDepts = [];
let deptConfigs = {};
let budget = { monthlyRevenue: 500, laborRatio: 25, headcounts: {}, locked: false };

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
  budget = { monthlyRevenue: 500, laborRatio: 25, headcounts: {}, locked: false };
  renderBudgetPlanner();
  updateDepts();
};

// ── Budget Planner ──
function parseRatioRange(str) {
  if (!str) return { min: 20, max: 40 };
  const m = str.match(/([\d.]+)\s*-\s*([\d.]+)/);
  return m ? { min: parseFloat(m[1]), max: parseFloat(m[2]) } : { min: 20, max: 40 };
}

function renderBudgetPlanner() {
  const el = document.getElementById('budgetPlanner');
  if (!selectedIndustry) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');

  const bench = INDUSTRY_BENCHMARKS[selectedIndustry];
  const range = parseRatioRange(bench ? bench.laborRate : '20%-40%');
  const mid = Math.round((range.min + range.max) / 2);
  if (!budget.locked) budget.laborRatio = mid;

  const depts = INDUSTRIES[selectedIndustry];
  const annualTotal = budget.monthlyRevenue * 12 * budget.laborRatio / 100;
  const defaultShare = Math.round(100 / depts.length);

  let deptRows = depts.map((d, i) => {
    const hc = budget.headcounts[d] !== undefined ? budget.headcounts[d] : 3;
    return `<div class="bp-dept">
      <span class="bp-dname">${d}</span>
      <input type="number" value="${hc}" min="0" max="200" onchange="window.updBudgetHeadcount('${d}',this.value)">
      <span style="font-size:12px;color:#90a4ae;">人</span>
      <span class="bp-dbudget" id="bd-${d}"></span>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="bp-title">
      📊 預算規劃
      <span class="toggle" onclick="document.getElementById('bpBody').classList.toggle('hidden')">收合</span>
    </div>
    <div id="bpBody">
      <div class="bp-row">
        <div class="bp-field"><label>月營業額目標（萬）</label><input type="number" id="bpRevenue" value="${budget.monthlyRevenue}" min="10" max="999999" onchange="window.updBudget('revenue',this.value)"></div>
        <div class="bp-field"><label>人事成本比例 %（建議 ${range.min}%-${range.max}%）</label><input type="number" id="bpRatio" value="${budget.laborRatio}" min="1" max="100" step="0.5" onchange="window.updBudget('ratio',this.value)"></div>
        <div class="bp-field" style="display:flex;align-items:flex-end;gap:8px;">
          <button class="bp-apply" onclick="window.applyBudget()">套用至部門</button>
          <button class="btn" onclick="window.resetBudget()">重設</button>
        </div>
      </div>
      <div class="bp-total">年人事總預算 <strong id="bpTotal"></strong> <small id="bpMonthly"></small></div>
      <div class="bp-depts" id="bpDepts">${deptRows}</div>
      <div class="bp-hint">💡 調整各部門人數後，系統自動按比例分配預算。點「套用至部門」將預算寫入部門卡片。</div>
    </div>`;
  updateBudgetDisplay();
}

function updateBudgetDisplay() {
  const depts = INDUSTRIES[selectedIndustry];
  if (!depts) return;
  const annualTotal = budget.monthlyRevenue * 12 * budget.laborRatio / 100;
  const totalEl = document.getElementById('bpTotal');
  const monthEl = document.getElementById('bpMonthly');
  if (totalEl) totalEl.textContent = `NT$ ${annualTotal.toLocaleString()} 萬`;
  if (monthEl) monthEl.textContent = `（月均 NT$ ${(annualTotal / 12).toLocaleString()} 萬）`;

  depts.forEach(d => { if (budget.headcounts[d] === undefined) budget.headcounts[d] = 3; });
  const totalHC = depts.reduce((s, d) => s + budget.headcounts[d], 0);
  depts.forEach(d => {
    const hc = budget.headcounts[d];
    const deptBudget = totalHC > 0 ? Math.round(annualTotal * hc / totalHC) : 0;
    const bdEl = document.getElementById(`bd-${d}`);
    if (bdEl) bdEl.textContent = hc > 0 ? `NT$${deptBudget.toLocaleString()}萬` : '—';
  });
}

window.updBudget = function(field, val) {
  if (field === 'revenue') budget.monthlyRevenue = parseFloat(val) || 500;
  if (field === 'ratio') budget.laborRatio = parseFloat(val) || 25;
  updateBudgetDisplay();
};

window.updBudgetHeadcount = function(dept, val) {
  const n = parseInt(val);
  budget.headcounts[dept] = !isNaN(n) && n >= 0 ? n : 1;
  updateBudgetDisplay();
};

window.resetBudget = function() {
  budget = { monthlyRevenue: 500, laborRatio: 25, headcounts: {}, locked: false };
  deptConfigs = {};
  renderBudgetPlanner();
  updateDepts();
};

window.applyBudget = function() {
  const depts = INDUSTRIES[selectedIndustry];
  const annualTotal = budget.monthlyRevenue * 12 * budget.laborRatio / 100;
  const totalHC = depts.reduce((s, d) => s + (budget.headcounts[d] || 0), 0);

  depts.forEach(d => {
    const hc = budget.headcounts[d] || 0;
    if (hc === 0) { delete deptConfigs[d]; return; }
    const deptBudget = totalHC > 0 ? Math.round(annualTotal * hc / totalHC) : 0;
    const perPerson = Math.round(deptBudget / hc);
    deptConfigs[d] = createDeptConfig(d, perPerson * 10000);
    if (!selectedDepts.includes(d)) selectedDepts.push(d);
  });
  budget.locked = true;
  renderBudgetPlanner();
  updateDepts();
};

// ── Department Cards ──
function updateDepts() {
  const container = document.getElementById('deptCards');
  const depts = selectedIndustry ? INDUSTRIES[selectedIndustry] : ALL_DEPTS;

  if (!selectedIndustry) {
    container.innerHTML = `<div class="empty">請先選擇產業類別</div>`;
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

    const subj = DEPT_SUBJECTS[d];
    const floatPct = (cfg || r).behaviorRatio + (cfg || r).performanceRatio;
    const fr = cfg ? cfg.fixedRatio : r.fixed;
    const br = cfg ? cfg.behaviorRatio : r.behavior;
    const pr = cfg ? cfg.performanceRatio : r.performance;
    const floatAmt = bc + pc;
    return `<div class="d-card ${checked ? 'on' : 'off'}" id="card-${d}">
      <div class="d-head" onclick="window.toggleDept('${d}')">
        <input type="checkbox" ${checked ? 'checked' : ''} onclick="event.stopPropagation();window.toggleDept('${d}')">
        <span class="d-name">${d}</span>
        <span class="d-type ${tClass}">${type}</span>
      </div>
      <div class="d-body ${checked ? '' : 'hidden'}">
        <div class="d-controls">
          <div class="d-ctl"><label>年薪總包</label><input type="number" value="${ac}" min="200000" max="5000000" step="10000" onchange="window.updCfg('${d}','total',this.value)"></div>
          <div class="d-ctl"><label>固定 %</label><input type="number" value="${fr}" min="0" max="100" onchange="window.updCfg('${d}','fixedPct',this.value)"></div>
          <div class="d-ctl"><label>行為(考核) %</label><input type="number" value="${br}" min="0" max="100" onchange="window.updCfg('${d}','behavePct',this.value)"></div>
          <div class="d-ctl"><label>績效 %</label><input type="number" value="${pr}" min="0" max="100" onchange="window.updCfg('${d}','perfPct',this.value)"></div>
        </div>
        <div class="d-preview">
          <div class="d-panel fixed">
            <div class="d-panel-title">■ 固定 ${fr}%</div>
            <div class="d-panel-amt">NT$ ${fc.toLocaleString()} <small>年</small></div>
            <div class="d-panel-rows">
              <div>月固定薪 <strong>NT$ ${mb.toLocaleString()}</strong></div>
              <div class="subj">${subj.base.join('、')}</div>
            </div>
          </div>
          <div class="d-panel float">
            <div class="d-panel-title">■ 浮動 ${floatPct}%</div>
            <div class="d-panel-amt">NT$ ${floatAmt.toLocaleString()} <small>年</small></div>
            <div class="d-panel-rows">
              <div>行為考核 ${br}%<strong>NT$ ${bc.toLocaleString()}</strong></div>
              <div class="subj">${subj.behavior.join('、')}</div>
              <div style="margin-top:6px;">績效 ${pr}%<strong>NT$ ${pc.toLocaleString()}</strong></div>
              <div class="subj">${subj.performance.join('、')}</div>
            </div>
          </div>
        </div>
        <div class="d-extra">
          <div class="d-extra-item bonus">公司分紅（外加）：${subj.bonus.join('、')}</div>
          <div class="d-extra-item welfare">其他福利（外加）：${subj.welfare.join('、')}</div>
          <div class="d-extra-item risk">風險條件：${subj.risks.join('、')}</div>
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
  if (!deptConfigs[d]) deptConfigs[d] = createDeptConfig(d, 600000);
  const cfg = deptConfigs[d];
  const v = parseInt(value) || 0;
  if (field === 'total') {
    cfg.annualTotal = v || 600000;
  } else if (field === 'fixedPct') {
    cfg.fixedRatio = Math.min(100, Math.max(0, v));
    const remain = 100 - cfg.fixedRatio;
    const totalFloat = cfg.behaviorRatio + cfg.performanceRatio;
    if (totalFloat > 0) {
      cfg.behaviorRatio = Math.round(remain * cfg.behaviorRatio / totalFloat);
      cfg.performanceRatio = remain - cfg.behaviorRatio;
    } else {
      cfg.behaviorRatio = Math.round(remain * 0.5);
      cfg.performanceRatio = remain - cfg.behaviorRatio;
    }
  } else if (field === 'behavePct') {
    cfg.behaviorRatio = Math.min(100 - cfg.fixedRatio, Math.max(0, v));
    cfg.performanceRatio = 100 - cfg.fixedRatio - cfg.behaviorRatio;
  } else if (field === 'perfPct') {
    cfg.performanceRatio = Math.min(100 - cfg.fixedRatio, Math.max(0, v));
    cfg.behaviorRatio = 100 - cfg.fixedRatio - cfg.performanceRatio;
  }
  cfg.fixedAnnual = Math.round(cfg.annualTotal * cfg.fixedRatio / 100);
  cfg.behaviorAnnual = Math.round(cfg.annualTotal * cfg.behaviorRatio / 100);
  cfg.perfAnnual = Math.round(cfg.annualTotal * cfg.performanceRatio / 100);
  cfg.monthlyBase = Math.round(cfg.fixedAnnual / 12);
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
    const floatPct = cfg.behaviorRatio + cfg.performanceRatio;
    return `<tr class="t-${tc}"><td><strong>${d}</strong></td><td><span class="d-type ${tc}" style="font-size:10px;">${type}</span></td>
      <td class="r">NT$ ${cfg.monthlyBase.toLocaleString()}</td>
      <td class="r">NT$ ${cfg.fixedAnnual.toLocaleString()}</td>
      <td class="r">NT$ ${cfg.behaviorAnnual.toLocaleString()}</td>
      <td class="r">NT$ ${cfg.perfAnnual.toLocaleString()}</td>
      <td class="r"><strong>NT$ ${cfg.annualTotal.toLocaleString()}</strong></td>
      <td class="r">${cfg.fixedRatio}:${floatPct}</td></tr>`;
  }).join('');

  const grand = totalF + totalB + totalP;
  container.innerHTML = `<table class="stbl"><thead><tr><th>部門</th><th>型</th><th class="r">月固定</th><th class="r">年固定</th><th class="r">行為(考核)</th><th class="r">績效</th><th class="r">年薪總包</th><th class="r">固:浮</th></tr></thead>
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
    const range = parseRatioRange(bench.laborRate);
    const current = budget.locked ? budget.laborRatio : null;
    let status = '', color = '';
    if (current !== null) {
      if (current < range.min * 0.8) { status = '⚠️ 偏低 — 可能留不住人'; color = '#f39c12'; }
      else if (current <= range.max) { status = '✅ 很健康'; color = '#2e7d32'; }
      else if (current <= range.max * 1.3) { status = '⚡ 有問題 — 接近紅線'; color = '#e65100'; }
      else { status = '🔴 有危險 — 人事成本過高'; color = '#c62828'; }
      document.getElementById('benchmark').innerHTML =
        `<div class="bm" style="border-left:4px solid ${color};">
          <span>${selectedIndustry}</span> 建議 ${bench.laborRate} ｜ 目前設定 <strong>${current}%</strong> ${status}
          <br><small>毛利率參考 ${bench.grossMargin}</small>
        </div>`;
    } else {
      document.getElementById('benchmark').innerHTML =
        `<div class="bm"><span>${selectedIndustry}</span> 建議人事成本 <strong>${bench.laborRate}</strong> ｜ 毛利率參考 <strong>${bench.grossMargin}</strong></div>`;
    }
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
