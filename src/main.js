import { signInWithGoogle, signOut, onAuthChange, getCurrentUser, savePlan as supabaseSave } from './auth.js';
import { INDUSTRIES, DEPT_TYPE, DEPT_SUBJECTS, INDUSTRY_BENCHMARKS, JOB_TYPES, TYPE_RATIOS, TYPE_SUBJECTS, DEFAULT_GRADES, JOB_FAMILIES, DEFAULT_GRADE_MATRIX, FAMILY_PAYMIX, DEPT_JOB_FAMILY, ALL_DEPTS, getIndustryDepts, genDeptId, isKnownDept, getDeptRatios, getDeptSubjects, createDeptConfig, calcHealth, parseRange, defaultData, createDefaultAllocation, getJobFamilyForDept } from './data.js';

let curUser = null;
let currentStep = 1;
let data = null;
const STORAGE_KEY = 'salary_v2';

onAuthChange((e, u) => { if (u) { curUser = u; showApp(); } });
getCurrentUser().then(u => { if (u) { curUser = u; showApp(); } });
window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;

function showApp() {
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const meta = curUser.user_metadata || {};
  document.getElementById('userName').textContent = meta.full_name || curUser.email;
  document.getElementById('userAvatar').src = meta.avatar_url || '';
  init();
}

function init() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      data = JSON.parse(saved);
      if (data && data.industry && data.departments) { migrateData(); renderIndustries(); currentStep = data.step || 1; render(); renderPlanList(); return; }
    } catch(e) {}
  }
  renderIndustries();
}

function migrateData() {
  if (!data.gradeMatrix) data.gradeMatrix = JSON.parse(JSON.stringify(DEFAULT_GRADE_MATRIX));
  let changed = false;
  Object.keys(data.deptConfigs || {}).forEach(id => {
    const cfg = data.deptConfigs[id];
    if (cfg && !cfg.gradeAllocation) {
      const d = data.departments.find(x => x.id === id);
      const hc = data.headcounts[id] || 1;
      const alloc = createDefaultAllocation(hc, d ? d.name : '部門', cfg.type || '平路型', data.gradeMatrix);
      if (alloc.length) cfg.gradeAllocation = alloc;
      else cfg.gradeAllocation = [{ grade: -1, level: 1, title: '人員', headcount: hc, annualTotal: cfg.annualTotal || 600000, fixedRatio: 70, behaviorRatio: 10, performanceRatio: 20, subjects: { base: [{ name: '基本薪資', annual: Math.round((cfg.fixedAnnual || 420000) / 12) }], behavior: [{ name: '獎金', annual: Math.round((cfg.behaviorAnnual || 60000) / 12) }], performance: [{ name: '績效', annual: Math.round((cfg.perfAnnual || 120000) / 12) }] } }];
      changed = true;
    }
    // 補 ratio + 轉 subjects
    (cfg?.gradeAllocation || []).forEach(a => {
      if (a.fixedRatio === undefined) { a.fixedRatio = 40; changed = true; }
      if (a.behaviorRatio === undefined) { a.behaviorRatio = 10; changed = true; }
      if (a.performanceRatio === undefined) { a.performanceRatio = 50; changed = true; }
      ['base','behavior','performance'].forEach(cat => {
        (a.subjects?.[cat] || []).forEach(item => {
          if (item.annual === null) return;
          if (item.annual !== undefined) return;
          const val = item.monthly !== undefined ? Number(item.monthly) : (item.amount !== undefined ? Math.round(Number(item.amount) / 12) : 0);
          item.annual = val;
          delete item.monthly;
          delete item.amount;
          changed = true;
        });
      });
    });
  });
  if (changed) save();
}

function save() {
  if (data) { data.step = currentStep; localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
}
window.save = save;

function renderIndustries() {
  document.getElementById('industryChips').innerHTML = Object.keys(INDUSTRIES).map(ind =>
    `<button class="chip ${data && data.industry === ind ? 'active' : ''}" onclick="window.pickInd('${ind}')">${ind}</button>`
  ).join('');
}

window.pickInd = function(ind) {
  data = defaultData(ind);
  currentStep = 1;
  renderIndustries();
  save();
  render();
  renderPlanList();
};

function render() {
  if (!data) { document.getElementById('stepContent').innerHTML = '<div class="empty">請先選擇產業類別</div>'; renderSidebar(); return; }
  renderSteps();
  renderStepContent();
  renderSidebar();
}
window.render = render;

function getDepts() { return (data.departments || []).filter(d => d.enabled !== false); }

function getAnnualTotal() { return data.monthlyRevenue * 12 * data.laborRatio / 100; }

function getTotalHC() { return getDepts().reduce((s, d) => s + (data.headcounts[d.id] || 0), 0); }

function getDeptBudget(d) {
  const totalHC = getTotalHC();
  const hc = data.headcounts[d.id] || 0;
  return totalHC > 0 ? Math.round(getAnnualTotal() * hc / totalHC) : 0;
}

function calcAllocRow(a) {
  if (!a || typeof a !== 'object') { console.warn('calcAllocRow: invalid input', a); return emptyRow(); }
  const packageAnnual = Number(a.annualTotal) || 1;
  const fr = Number(a.fixedRatio) || 0;
  const br = Number(a.behaviorRatio) || 0;
  const pr = Number(a.performanceRatio) || 0;
  console.log('【calcAllocRow input】', { fixedRatio: a.fixedRatio, behaviorRatio: a.behaviorRatio, performanceRatio: a.performanceRatio, annualTotal: a.annualTotal });

  const targetBase  = Math.round(packageAnnual * fr / 100);
  const targetBehav = Math.round(packageAnnual * br / 100);
  const targetPerf  = Math.round(packageAnnual * pr / 100);

  const calcCat = (cat, target) => {
    const items = (a.subjects?.[cat] || []);
    const autoIdx = items.findIndex(s => s && s.annual === null);
    let manualTotal = 0;
    items.forEach((item, i) => { if (i !== autoIdx && item) manualTotal += (Number(item.annual) || 0); });
    const autoVal = target - manualTotal;
    const error = autoVal < 0;
    return {
      target, others: manualTotal, autoVal, autoIdx, error, items,
      subtotal: error ? manualTotal : target,
      diff: error ? manualTotal - target : 0
    };
  };

  const baseCat = calcCat('base', targetBase);
  const behaviorCat = calcCat('behavior', targetBehav);
  const performanceCat = calcCat('performance', targetPerf);

  const allocatedAnnual = targetBase + targetBehav + targetPerf;
  const unallocatedAnnual = packageAnnual - allocatedAnnual;
  const result = {
    fr, br, pr, pctSum: fr + br + pr,
    unallocated: fr + br + pr < 100 ? 100 - (fr + br + pr) : 0,
    pctOver: fr + br + pr > 100 ? fr + br + pr - 100 : 0,
    packageAnnual, allocatedAnnual, unallocatedAnnual,
    targetBase, targetBehav, targetPerf,
    monthlyBase: Math.round(targetBase / 12),
    monthlyBehavior: Math.round(targetBehav / 12),
    monthlyPerf: Math.round(targetPerf / 12),
    monthlyTotal: Math.round(allocatedAnnual / 12),
    over: allocatedAnnual - packageAnnual,
    baseCat, behaviorCat, performanceCat,
    anyError: baseCat.error || behaviorCat.error || performanceCat.error
  };
  console.log('【calcAllocRow result】', { fr, br, pr, pctSum: result.pctSum, targetBase, targetBehav, targetPerf,
    baseCat: { target: baseCat.target, others: baseCat.others, autoVal: baseCat.autoVal, subtotal: baseCat.subtotal, error: baseCat.error },
    behaviorCat: { target: behaviorCat.target, others: behaviorCat.others, autoVal: behaviorCat.autoVal, subtotal: behaviorCat.subtotal, error: behaviorCat.error },
    performanceCat: { target: performanceCat.target, others: performanceCat.others, autoVal: performanceCat.autoVal, subtotal: performanceCat.subtotal, error: performanceCat.error }
  });
  return result;
}

function emptyRow() {
  const e = () => ({ target:0, others:0, autoVal:0, autoIdx:-1, error:false, items:[], subtotal:0, diff:0 });
  return {
    fr:0, br:0, pr:0, pctSum:0, unallocated:100, pctOver:0,
    packageAnnual:0, allocatedAnnual:0, unallocatedAnnual:0,
    targetBase:0, targetBehav:0, targetPerf:0,
    monthlyBase:0, monthlyBehavior:0, monthlyPerf:0, monthlyTotal:0,
    over:0, baseCat:e(), behaviorCat:e(), performanceCat:e(), anyError:false
  };
}

function calcAllocSummary(alloc) {
  let totalHC = 0, totalAnnual = 0;
  (alloc || []).forEach(a => {
    const r = calcAllocRow(a);
    totalHC += a.headcount || 0;
    totalAnnual += (r.targetBase + r.targetBehav + r.targetPerf) * (a.headcount || 0);
  });
  return { totalHC, deptTotal: totalAnnual };
}

function ensureAlloc(d) {
  if (!d || !d.id) return;
  if (!data.gradeMatrix) data.gradeMatrix = JSON.parse(JSON.stringify(DEFAULT_GRADE_MATRIX));
  const cfg = data.deptConfigs[d.id];
  if (!cfg) {
    const totalHC = getTotalHC();
    const db = totalHC > 0 ? Math.round(getAnnualTotal() * (data.headcounts[d.id] || 0) / totalHC) : 0;
    const pp = (data.headcounts[d.id] || 0) > 0 ? Math.round(db / (data.headcounts[d.id] || 1)) * 10000 : 600000;
    data.deptConfigs[d.id] = createDeptConfig(d.id, d.name, d.type, pp);
  }
  const cfg2 = data.deptConfigs[d.id];
  if (cfg2.gradeAllocation && cfg2.gradeAllocation.length) return;
  const hc = data.headcounts[d.id] || 0;
  if (hc === 0) return;
  const alloc = createDefaultAllocation(hc, d.name, d.type, data.gradeMatrix);
  if (alloc && alloc.length) {
    cfg2.gradeAllocation = alloc;
  } else {
    cfg2.gradeAllocation = [{ grade: -1, level: 1, title: d.name + '人員', headcount: hc, annualTotal: 600000, fixedRatio: 40, behaviorRatio: 10, performanceRatio: 50, subjects: { base: [{ name: '基本薪資', annual: null }], behavior: [{ name: '獎金', annual: null }], performance: [{ name: '績效', annual: null }] } }];
  }
  save();
}

function renderSteps() {
  const labels = ['設定總預算', '配置部門人數', '薪酬結構設計', '職等職級對照', '總覽報表'];
  const states = ['pending','pending','pending','pending','pending'];
  for (let i = 0; i < currentStep; i++) states[i] = 'done';
  states[currentStep - 1] = 'active';
  const icons = ['❶','❷','❸','❹','❺'];
  document.getElementById('stepIndicator').innerHTML = states.map((s, i) => {
    const n = i + 1;
    return `${i > 0 ? '<span class="step-arrow">›</span>' : ''}<div class="step ${s}" onclick="window.goStep(${n})" style="cursor:pointer;"><div class="step-num">${icons[i]}</div><div class="step-label">${labels[i]}</div></div>`;
  }).join('');
}

window.goStep = function(n) {
  console.log('goStep called:', n, 'currentStep:', currentStep, 'totalHC:', getTotalHC());
  if (n < 1 || n > 5) return;
  if (n > currentStep + 1 && currentStep < 5) { console.log('Step blocked: too far ahead'); return; }
  currentStep = n;
  save();
  try { render(); } catch(e) { console.error('render error:', e); }
};

function renderStepContent() {
  const el = document.getElementById('stepContent');
  if (currentStep === 1) el.innerHTML = step1HTML();
  else if (currentStep === 2) el.innerHTML = step2HTML();
  else if (currentStep === 3) el.innerHTML = step3HTML();
  else if (currentStep === 4) el.innerHTML = step4HTML();
  else if (currentStep === 5) el.innerHTML = step5HTML();
}

function stepNav(nextLabel, allowNext) {
  return `<div class="step-nav">
    <button class="btn" onclick="window.goStep(${currentStep - 1})" ${currentStep <= 1 ? 'disabled' : ''}>‹ 上一步</button>
    <button class="btn-primary" onclick="window.goStep(${currentStep + 1})" ${!allowNext ? 'disabled' : ''}>${nextLabel} ›</button>
  </div>`;
}

// ── Step 1: Budget ──
function step1HTML() {
  const bench = INDUSTRY_BENCHMARKS[data.industry];
  const at = getAnnualTotal();
  return `<div class="scard">
    <div class="scard-title">❶ 設定總預算</div>
    <div class="scard-desc">填入月營業額，選擇人事成本比例，系統自動計算年人事總預算。</div>
    <div class="b1-grid">
      <div class="b1-field"><label>月營業額目標（萬）</label><input type="number" id="s1rev" value="${data.monthlyRevenue}" min="10" max="999999" onchange="window.updS1('rev',this.value)"></div>
      <div class="b1-field"><label>人事成本比例 %（${data.industry} 建議 ${bench ? bench.laborRate : '20%-40%'}）</label><input type="number" id="s1ratio" value="${data.laborRatio}" min="1" max="100" step="0.5" onchange="window.updS1('ratio',this.value)"></div>
    </div>
    <div class="b1-total">年人事總預算 <strong>NT$ ${at.toLocaleString()} 萬</strong> <small>（月均 NT$ ${(at/12).toLocaleString()} 萬）</small></div>
    <div class="b1-suggest">${bench ? `💡 ${data.industry} 業界參考：人事成本 ${bench.laborRate}，毛利率 ${bench.grossMargin}${bench.note ? `（${bench.note}）` : ''}` : ''}</div>
  </div>${stepNav('下一步：配置部門 ›', data.industry && data.laborRatio > 0)}`;
}

window.updS1 = function(field, val) {
  if (field === 'rev') data.monthlyRevenue = parseFloat(val) || 500;
  if (field === 'ratio') data.laborRatio = parseFloat(val) || 25;
  currentStep = 1;
  save();
  renderStepContent();
  renderSidebar();
};

// ── Step 2: Allocation + Department Management ──
function step2HTML() {
  const depts = getDepts();
  const at = getAnnualTotal();
  const totalHC = getTotalHC();
  let rows = depts.map(d => {
    const hc = data.headcounts[d.id] || 0;
    const db = getDeptBudget(d);
    const pct = at > 0 ? Math.round(db / at * 100) : 0;
    const tClass = d.type === '上山型' ? 'up' : d.type === '平路型' ? 'flat' : 'down';
    return `<tr data-dept-id="${d.id}">
      <td><span style="color:#94a3b8;margin-right:6px;user-select:none;">⠿</span><strong>${d.name}</strong> <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:${tClass==='up'?'#e3f2fd':tClass==='flat'?'#f3e5f5':'#e0f2fe'};color:#1e293b;">${d.type}</span></td>
      <td><input type="number" value="${hc}" min="0" max="9999" onchange="window.updS2HC('${d.id}',this.value)" style="width:64px;padding:6px 8px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:14px;text-align:center;"></td>
      <td class="r">${hc > 0 ? `NT$ ${db.toLocaleString()} 萬` : '—'}</td>
      <td class="r">${hc > 0 ? `${pct}%` : '—'}</td>
    </tr>`;
  }).join('');
  return `<div class="scard">
    <div class="scard-title" style="display:flex;align-items:center;justify-content:space-between;">
      <span>❷ 配置部門人數</span>
      <div>
        <button class="btn" onclick="window.showDeptModal()" style="margin-right:8px;">⚙ 管理部門</button>
        <button class="btn" onclick="window.showDeptSortModal()">↕ 排序部門</button>
      </div>
    </div>
    <div class="scard-desc">填入各部門人數，預算按人數比例自動分配（總 ${totalHC} 人）。人數為 0 則不分配預算。</div>
    <table class="b2-table" id="deptSortTable"><thead><tr><th style="width:40%;">部門</th><th style="width:80px;">人數</th><th class="r">部門年預算</th><th class="r">佔比</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="b2-total"><td><strong>合計</strong></td><td><strong>${totalHC}</strong></td><td class="r"><strong>NT$ ${at.toLocaleString()} 萬</strong></td><td class="r"><strong>100%</strong></td></tr></tfoot>
    </table>
  </div>${stepNav('下一步：薪酬結構 ›', totalHC > 0)}`;
}

window.updS2HC = function(deptId, val) {
  const n = parseInt(val);
  data.headcounts[deptId] = !isNaN(n) && n >= 0 ? n : 0;
  save();
  renderStepContent();
  renderSidebar();
};

// ── Department Management Modal ──
window.showDeptModal = function() {
  const bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;display:flex;align-items:center;justify-content:center;';
  bg.onclick = e => { if (e.target === bg) bg.remove(); };
  const depts = data.departments;
  const rows = depts.map(d => {
    const tClass = d.type === '上山型' ? 'up' : d.type === '平路型' ? 'flat' : 'down';
    return `<tr>
      <td><input value="${d.name}" onchange="window.renameDept('${d.id}',this.value)" style="width:120px;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;"></td>
      <td><select onchange="window.changeDeptType('${d.id}',this.value)" style="padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;">${JOB_TYPES.map(t => `<option value="${t}" ${t === d.type ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
      <td><span style="font-size:10px;padding:2px 6px;border-radius:4px;background:${tClass==='up'?'#e3f2fd':tClass==='flat'?'#f3e5f5':'#e0f2fe'};">${d.type}</span></td>
      <td><label><input type="checkbox" ${d.enabled !== false ? 'checked' : ''} onchange="window.toggleDept('${d.id}',this.checked)"> 啟用</label></td>
      <td><button class="btn" onclick="window.deleteDept('${d.id}')" style="color:#ef4444;">刪除</button></td>
    </tr>`;
  }).join('');
  bg.innerHTML = `<div style="background:#fff;border-radius:12px;padding:28px;min-width:580px;max-width:700px;box-shadow:0 20px 60px rgba(0,0,0,.2);" onclick="event.stopPropagation()">
    <h3 style="margin-bottom:16px;font-size:16px;font-weight:700;">管理部門</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="border-bottom:2px solid #e2e8f0;"><th style="text-align:left;padding:8px;">部門名稱</th><th style="text-align:left;padding:8px;">型態</th><th style="padding:8px;"></th><th style="padding:8px;"></th><th style="padding:8px;"></th></tr></thead><tbody>${rows}</tbody></table>
    <div style="margin-top:12px;display:flex;gap:8px;"><select id="newDeptType" style="padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:6px;">${JOB_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}</select><button class="btn-primary" onclick="window.addDept()">＋ 新增部門</button></div>
    <div style="margin-top:16px;text-align:right;"><button class="btn-primary btn-modal-done">完成</button></div>
  </div>`;
  document.body.appendChild(bg);
  bg.querySelector('.btn-modal-done').onclick = function() { bg.remove(); save(); render(); };
};
window.renameDept = function(id, name) { const d = data.departments.find(x => x.id === id); if (d) { d.name = name || d.name; save(); } };
window.changeDeptType = function(id, type) { const d = data.departments.find(x => x.id === id); if (d) { d.type = type; save(); } };
window.toggleDept = function(id, on) { const d = data.departments.find(x => x.id === id); if (d) { d.enabled = on; save(); } };
window.deleteDept = function(id) {
  if (!confirm('確定刪除此部門？')) return;
  data.departments = data.departments.filter(x => x.id !== id);
  delete data.headcounts[id]; delete data.deptConfigs[id];
  save(); window.showDeptModal(); render();
};
window.addDept = function() {
  const type = document.getElementById('newDeptType').value;
  const id = genDeptId();
  data.departments.push({ id, name: '新部門', type, enabled: true });
  data.headcounts[id] = 0;
  save(); window.showDeptModal(); render();
};

// ── Department Sort Modal ──
window.showDeptSortModal = function() {
  const bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;display:flex;align-items:center;justify-content:center;';
  bg.onclick = e => { if (e.target === bg) bg.remove(); };
  const depts = data.departments;
  let items = depts.map(d =>
    `<div class="sort-item" data-id="${d.id}" draggable="true" style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:6px;cursor:grab;display:flex;align-items:center;gap:10px;font-size:14px;">
      <span style="color:#94a3b8;">⠿</span><strong>${d.name}</strong><span style="font-size:11px;color:#64748b;">${d.type}</span>
    </div>`
  ).join('');
  bg.innerHTML = `<div style="background:#fff;border-radius:12px;padding:28px;min-width:420px;box-shadow:0 20px 60px rgba(0,0,0,.2);" onclick="event.stopPropagation()">
    <h3 style="margin-bottom:12px;font-size:16px;font-weight:700;">拖曳調整部門順序</h3>
    <div id="sortContainer">${items}</div>
    <div style="margin-top:16px;text-align:right;"><button class="btn-primary btn-modal-done">完成</button></div>
  </div>`;
  document.body.appendChild(bg);
  bg.querySelector('.btn-modal-done').onclick = function() { bg.remove(); save(); render(); };
  initSortDrag();
};
function initSortDrag() {
  let dragEl = null;
  document.querySelectorAll('.sort-item').forEach(el => {
    el.addEventListener('dragstart', e => { dragEl = el; e.dataTransfer.effectAllowed = 'move'; el.style.opacity = '.4'; });
    el.addEventListener('dragend', e => { el.style.opacity = '1'; dragEl = null; });
    el.addEventListener('dragover', e => {
      e.preventDefault();
      if (el !== dragEl) {
        const rect = el.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const parent = el.parentElement;
        if (e.clientY < mid) parent.insertBefore(dragEl, el); else parent.insertBefore(dragEl, el.nextSibling);
      }
    });
  });
  document.getElementById('sortContainer').addEventListener('dragend', () => {
    const ids = [...document.querySelectorAll('.sort-item')].map(el => el.dataset.id);
    const map = {};
    data.departments.forEach(d => map[d.id] = d);
    data.departments = ids.map(id => map[id]).filter(Boolean);
    save();
  });
}

// ── Step 3: Structure with Grade Allocation ──
function step3HTML() {
  try {
    return _step3HTML();
  } catch(e) {
    console.error('step3HTML error:', e);
    return `<div class="scard"><div class="scard-title">❸ 薪酬結構設計</div><div class="empty">初始化錯誤：${e.message}。請按 F12 查看 Console 錯誤訊息。</div><button class="btn" onclick="window.goStep(2)" style="margin-top:12px;">‹ 返回配置部門</button></div>`;
  }
}

function _step3HTML() {
  const depts = getDepts();
  let cards = depts.map(d => {
    const hc = data.headcounts[d.id] || 0;
    if (hc === 0) return '';
    ensureAlloc(d);
    const db = getDeptBudget(d) * 10000;
    const alloc = data.deptConfigs[d.id] ? data.deptConfigs[d.id].gradeAllocation : null;
    if (!alloc || !alloc.length) return '';
    const summary = calcAllocSummary(alloc);
    const usage = db > 0 ? Math.round(summary.deptTotal / db * 100) : 0;
    const tClass = d.type === '上山型' ? 'up' : d.type === '平路型' ? 'flat' : 'down';
    const usgColor = usage <= 80 ? '#10b981' : usage <= 100 ? '#f59e0b' : '#ef4444';
    const usgLabel = usage <= 80 ? '✅ 有餘裕' : usage <= 100 ? '⚠ 接近預算' : '🚫 超出預算！';
    const borderColor = usage > 100 ? '#ef4444' : '#e2e8f0';

    // Build allocation rows — monthly-based
    const expandedState = window._expanded || {};
    const allocRows = alloc.map((a, ai) => {
      const isOpen = expandedState[`${d.id}_${ai}`];
      const jf = getJobFamilyForDept(d.type);
      const grades = (data.gradeMatrix || DEFAULT_GRADE_MATRIX)[jf] || [];
      const titleOptions = grades.map(g => `<option value="${g.grade}" ${g.grade === a.grade ? 'selected' : ''}>${g.title} ${g.grade}等</option>`).join('');
      const r = calcAllocRow(a);
      const catKeys = ['base','behavior','performance'];
      const catLabels = { base: '固定', behavior: '行為', performance: '績效' };
      const catColors = { base: '#1a237e', behavior: '#e65100', performance: '#2e7d32' };
      const catTarget = { base: 40, behavior: 10, performance: 50 };

      const detailHtml = isOpen ? `<div class="alloc-detail" style="padding:8px 12px;background:#fff;border-top:1px solid #e2e8f0;">
        <!-- Header -->
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px;font-size:13px;padding-bottom:6px;border-bottom:1px solid #e2e8f0;">
          <strong>${a.title} ${a.grade}等</strong>
          <span>人數 ${a.headcount}</span>
          <span>目標年薪總包 NT$ ${a.annualTotal.toLocaleString()}</span>
          <span>已配置 NT$ ${r.allocatedAnnual.toLocaleString()}（${r.pctSum}%）</span>
          <span style="color:${r.pctOver > 0 ? '#ef4444' : r.unallocated > 0 ? '#f59e0b' : '#10b981'};">
            ${r.pctOver > 0 ? `🚫 超出 ${r.pctOver}%` : r.unallocated > 0 ? `未配置 ${r.unallocated}%（NT$ ${r.unallocatedAnnual.toLocaleString()}）` : '✅ 已配置 100%'}
          </span>
        </div>
        <!-- 3-column cards -->
        <div class="alloc-detail-grid">
          ${catKeys.map(cat => {
            const c = r[cat + 'Cat'];
            const pctVal = { base: r.fr, behavior: r.br, performance: r.pr }[cat];
            const targetVal = { base: r.targetBase, behavior: r.targetBehav, performance: r.targetPerf }[cat];
            const monthlyVal = { base: r.monthlyBase, behavior: r.monthlyBehavior, performance: r.monthlyPerf }[cat];
            const template = data.deptConfigs[d.id]?.subjects || {};
            const templateCats = template[cat] || [];
            const usedNames = (a.subjects?.[cat] || []).map(s => s.name);
            const available = templateCats.filter(n => !usedNames.includes(n) && typeof n === 'string');
            return `<div class="alloc-card alloc-card-${cat}"${c.error ? ' style="border-color:#ef4444;background:#fef2f2;"' : ''}>
              <div style="font-weight:600;color:${catColors[cat]};margin-bottom:4px;display:flex;align-items:center;gap:4px;font-size:13px;">
                ${catLabels[cat]}
                <input type="number" value="${pctVal}" min="0" max="100"
                  data-debug-dept="${d.id}"
                  data-debug-idx="${ai}"
                  data-debug-ratio="${cat}"
                  style="width:40px;padding:1px 4px;border:1px solid #e2e8f0;border-radius:3px;font-size:11px;text-align:center;"
                  oninput="window.updateAllocPctDraft('${d.id}',${ai},'${cat}',this.value)"
                  onblur="window.commitAllocPct('${d.id}',${ai},'${cat}',this.value)">
                <span style="font-size:11px;font-weight:400;color:#64748b;">%</span>
              </div>
              <div style="font-size:11px;color:#64748b;margin-bottom:6px;">
                目標 NT$ ${targetVal.toLocaleString()}/年 · NT$ ${monthlyVal.toLocaleString()}/月
              </div>
              ${c.items.length === 0 ? `<div style="font-size:11px;color:#94a3b8;font-style:italic;margin-bottom:4px;">（尚無科目）</div>` : ''}
              ${c.items.map((s, si) => {
                const isAuto = si === c.autoIdx;
                const val = isAuto ? c.autoVal : (s.annual || 0);
                const strVal = typeof s === 'string' ? s : (s.name || '');
                const displayVal = isAuto ? Math.max(0, c.autoVal) : val;
                return isAuto
                  ? `<div class="alloc-auto-item">
                       <span style="font-size:10px;color:#64748b;">⚙</span>
                       <span style="color:#64748b;font-style:italic;">${strVal}</span>
                       <span style="margin-left:auto;font-weight:600;color:${c.error ? '#ef4444' : '#1e293b'};">${c.error ? `⚠ ${c.autoVal.toLocaleString()}` : displayVal.toLocaleString()}</span>
                     </div>`
                  : `<div class="alloc-manual-item">
                       <span style="min-width:50px;font-size:11px;">${strVal}</span>
                       <input type="number" value="${val}" min="0" style="width:55px;padding:2px 4px;border:1px solid #e2e8f0;border-radius:3px;font-size:11px;text-align:right;" onchange="window.updAllocSubj('${d.id}',${ai},'${cat}',${si},this.value)">
                       <span style="font-size:10px;color:#94a3b8;">/年</span>
                       <span style="font-size:10px;color:#94a3b8;">月${Math.round(val/12).toLocaleString()}</span>
                       <span style="cursor:pointer;color:#ef4444;font-size:14px;" onclick="window.delAllocSubj('${d.id}',${ai},'${cat}',${si})">×</span>
                     </div>`;
              }).join('')}
              <div style="margin-top:4px;">
                <select onchange="window.addAllocSubj('${d.id}',${ai},'${cat}',this.value);this.value='';" style="font-size:10px;padding:1px 4px;border:1px solid #e2e8f0;border-radius:3px;width:100%;">
                  <option value="">＋ 新增科目</option>
                  ${available.map(n => `<option value="${n}">${n}</option>`).join('')}
                  <option value="__custom__">✏ 自訂</option>
                </select>
              </div>
              <div style="margin-top:4px;padding-top:4px;border-top:1px solid #e2e8f0;font-size:11px;display:flex;justify-content:space-between;">
                <span>小計 <strong>NT$ ${c.subtotal.toLocaleString()}</strong></span>
                <span style="color:${c.error ? '#ef4444' : '#10b981'};">
                  ${c.error ? `🚫 超出 ${c.diff.toLocaleString()}` : `✅ 差 ${c.diff.toLocaleString()}`}
                </span>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>` : '';

      const catVals = catKeys.map(cat => {
        const c = r[cat + 'Cat'];
        const mVal = { base: r.monthlyBase, behavior: r.monthlyBehavior, performance: r.monthlyPerf }[cat];
        const pctVal = { base: r.fr, behavior: r.br, performance: r.pr }[cat];
        return `<span style="color:${catColors[cat]};">${catLabels[cat]} NT$ ${c.target.toLocaleString()}/年（${pctVal}%）${c.error ? ' 🚫' : ''}</span>`;
      }).join('');

      return `<div style="border-bottom:1px solid #f1f5f9;">
        <div class="alloc-summary" style="padding:6px 12px;cursor:pointer;" onclick="window.toggleAlloc('${d.id}',${ai})">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span style="color:#94a3b8;font-size:14px;">${isOpen ? '▾' : '▸'}</span>
            <select onchange="window.updAllocCell('${d.id}',${ai},'grade',this.value);event.stopPropagation();" style="font-size:13px;font-weight:600;padding:1px 4px;border:1px solid #e2e8f0;border-radius:4px;" onclick="event.stopPropagation()">${titleOptions}</select>
            <input type="number" value="${a.headcount}" min="0" max="999" style="width:40px;padding:1px 4px;border:1px solid #e2e8f0;border-radius:4px;font-size:12px;text-align:center;" onchange="window.updAllocCell('${d.id}',${ai},'hc',this.value);event.stopPropagation();" onclick="event.stopPropagation()">
            <span style="margin-left:auto;font-size:12px;color:#64748b;">目標 ${a.annualTotal.toLocaleString()}/年</span>
            ${ai > 0 ? `<button class="btn" style="font-size:10px;padding:0 6px;color:#ef4444;" onclick="window.delAllocRow('${d.id}',${ai});event.stopPropagation();">✕</button>` : ''}
          </div>
          <div style="display:flex;gap:12px;margin-top:2px;margin-left:22px;font-size:11px;flex-wrap:wrap;">
            ${catVals}
            <span style="color:#475569;">合 ${r.monthlyTotal.toLocaleString()}/月 · ${r.allocatedAnnual.toLocaleString()}/年 × ${a.headcount}人${r.unallocated > 0 ? ` · 未配置 ${r.unallocated}%` : ''}</span>
          </div>
        </div>
        ${detailHtml}
      </div>`;
    }).join('');

    const summaryAlloc = calcAllocSummary(alloc);
    const budgetDiff = summaryAlloc.deptTotal - db;
    const budgetDisplay = usage <= 100
      ? `預算使用率 ${usage}% · 剩餘 NT$ ${Math.round(Math.abs(budgetDiff) / 10000).toLocaleString()} 萬`
      : `預算使用率 ${usage}% · 超出 ${usage - 100}%（NT$ ${Math.round(budgetDiff / 10000).toLocaleString()} 萬）`;

    // Find over-budget sources per grade
    const overSources = alloc.map(a => {
      const r = calcAllocRow(a);
      const rowTotal = r.allocatedAnnual * (a.headcount || 0);
      return { title: a.title, hc: a.headcount, annual: rowTotal, over: rowTotal - (a.annualTotal * (a.headcount || 0)) };
    }).filter(x => x.over > 0).slice(0, 3);

    const totRow = summaryAlloc.totalHC > 0 ? `<div style="padding:8px 12px;font-size:13px;font-weight:700;background:#f8fafc;border-top:2px solid #0f172a;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
        <span>合計 <strong>${summaryAlloc.totalHC}人</strong></span>
        <span>實計年薪 <strong>NT$ ${summaryAlloc.deptTotal.toLocaleString()}</strong></span>
        <span style="color:${usage > 100 ? '#ef4444' : usage > 80 ? '#f59e0b' : '#10b981'};">${budgetDisplay}</span>
      </div>
      ${usage > 100 && overSources.length ? `<div style="font-size:11px;color:#ef4444;font-weight:400;margin-top:4px;padding-top:4px;border-top:1px solid #fecaca;">
        超標來源：${overSources.map(s => `${s.title}${s.hc}人（超 NT$ ${(s.over / 10000).toFixed(1)}萬）`).join(' · ')}
      </div>` : ''}
      ${usage <= 100 && usage > 80 ? `<div style="font-size:11px;color:#f59e0b;font-weight:400;margin-top:4px;">⚠ 接近預算上限（${usage}%），建議調整人數或年薪</div>` : ''}
    </div>` : '';

    return `<div class="str-card" data-dept-id="${d.id}" style="border-color:${borderColor};${usage > 100 ? 'box-shadow:0 0 0 2px #ef4444;' : ''}">
      <div class="str-head" draggable="true" data-drag-id="${d.id}" style="cursor:grab;">
        <span style="color:#94a3b8;font-size:14px;user-select:none;">⠿</span>
        <span class="s-name">${d.name}</span>
        <span style="font-size:11px;padding:3px 8px;border-radius:4px;background:${tClass==='up'?'#e3f2fd':tClass==='flat'?'#f3e5f5':'#e0f2fe'};color:#1e293b;">${d.type}</span>
        <span class="s-hc">${summary.totalHC}人</span>
        <span class="s-budget">預算 NT$ ${Math.round(db/10000).toLocaleString()} 萬</span>
        <span style="font-size:12px;font-weight:600;color:${usgColor};">${budgetDisplay}</span>
      </div>
      <div class="str-body" style="padding:0;">
        ${allocRows}
        ${totRow}
        <div style="display:flex;gap:8px;padding:8px;border-top:1px solid #e2e8f0;">
          <button class="btn" style="font-size:11px;padding:4px 10px;" onclick="window.addAllocRow('${d.id}')">＋ 新增職等</button>
          <button class="btn" style="font-size:11px;padding:4px 10px;" onclick="window.showSubjectsEditor('${d.id}')">✏ 編輯科目</button>
        </div>
      </div>
    </div>`;
  }).join('');
  return `<div class="scard">
    <div class="scard-title">❸ 薪酬結構設計</div>
    <div class="scard-desc">設定各部門各職等的人數、年薪總包與固定/行為/績效比例。展開明細可編輯各科目金額。拖曳卡片調整部門順序。</div>
    ${cards || '<div class="empty">尚無部門可配置</div>'}
  </div>${stepNav('下一步：職等職級對照 ›', true)}`;
}

function findGradeForSal(salary) {
  const jf = data.activeJobFamily || '管理系';
  const matrix = (data.gradeMatrix && data.gradeMatrix[jf]) || DEFAULT_GRADE_MATRIX['管理系'];
  for (const g of matrix) {
    for (const l of g.levels) {
      if (salary >= l.min && salary <= l.max) return { grade: g.grade, title: g.title, level: l.level, ok: true };
    }
  }
  const last = matrix[matrix.length - 1];
  const lastMax = last ? last.levels[last.levels.length - 1]?.max || 999999 : 999999;
  const first = matrix[0];
  return salary > lastMax
    ? { grade: last ? last.grade : 99, title: last ? last.title : '', level: '↑', ok: false }
    : { grade: first ? first.grade : 0, title: first ? first.title : '', level: '↓', ok: false };
}

// ── Step 3 Allocation Row Management ──
window._expanded = {};
window.closeModal = function(btn) {
  let el = btn;
  while (el && !(el.tagName === 'DIV' && el.style.position === 'fixed')) el = el.parentElement;
  if (el) el.remove();
  setTimeout(() => { try { window.save(); window.render(); } catch(e) { console.error(e); location.reload(); } }, 30);
};

window.toggleAlloc = function(deptId, idx) {
  const key = `${deptId}_${idx}`;
  window._expanded[key] = !window._expanded[key];
  renderStepContent();
};

window.updAllocCell = function(deptId, idx, field, val) {
  const alloc = data.deptConfigs[deptId]?.gradeAllocation;
  if (!alloc || !alloc[idx]) return;
  const a = alloc[idx];
  const num = parseInt(val) || 0;
  if (field === 'grade') {
    const jf = getJobFamilyForDept((data.departments.find(x => x.id === deptId) || {}).type);
    const grades = (data.gradeMatrix || DEFAULT_GRADE_MATRIX)[jf] || [];
    const g = grades.find(x => x.grade === Number(val));
    if (g) { a.grade = g.grade; a.title = g.title; a.level = g.levels[Math.floor(g.levels.length / 2)]?.level || 1; }
  } else if (field === 'hc') { a.headcount = Math.min(999, Math.max(0, num)); }
  save();
  renderStepContent();
};

// ── Ratio input: draft on input, commit on blur ──
window.updateAllocPctDraft = function(deptId, idx, cat, pctVal) {
  const alloc = data.deptConfigs[deptId]?.gradeAllocation;
  if (!alloc || !alloc[idx]) return;
  const pct = Math.min(100, Math.max(0, parseInt(pctVal) || 0));
  const map = { base: 'fixedRatio', behavior: 'behaviorRatio', performance: 'performanceRatio' };
  alloc[idx][map[cat]] = pct;
};

window.commitAllocPct = function(deptId, idx, cat, pctVal) {
  const alloc = data.deptConfigs[deptId]?.gradeAllocation;
  if (!alloc || !alloc[idx]) return;
  const a = alloc[idx];
  const pct = Math.min(100, Math.max(0, parseInt(pctVal) || 0));
  const map = { base: 'fixedRatio', behavior: 'behaviorRatio', performance: 'performanceRatio' };
  a[map[cat]] = pct;
  save();
  renderStepContent();
};

window.updAllocSubj = function(deptId, idx, cat, si, val) {
  const alloc = data.deptConfigs[deptId]?.gradeAllocation;
  if (!alloc || !alloc[idx] || !alloc[idx].subjects || !alloc[idx].subjects[cat]) return;
  const item = alloc[idx].subjects[cat][si];
  if (item.annual === null) return; // auto-balance, don't edit directly
  item.annual = Math.max(0, parseInt(val) || 0);
  save();
  renderStepContent();
};

window.addAllocSubj = function(deptId, idx, cat, name) {
  if (!name || name === '' || name === '__custom__') { name = prompt('請輸入科目名稱：'); if (!name) return; }
  const alloc = data.deptConfigs[deptId]?.gradeAllocation;
  if (!alloc || !alloc[idx]) return;
  if (!alloc[idx].subjects) alloc[idx].subjects = { base: [], behavior: [], performance: [] };
  if (!alloc[idx].subjects[cat]) alloc[idx].subjects[cat] = [];
  alloc[idx].subjects[cat].push({ name, annual: 0 });
  save();
  renderStepContent();
};

window.delAllocSubj = function(deptId, idx, cat, si) {
  const alloc = data.deptConfigs[deptId]?.gradeAllocation;
  if (!alloc || !alloc[idx] || !alloc[idx].subjects || !alloc[idx].subjects[cat]) return;
  alloc[idx].subjects[cat].splice(si, 1);
  save();
  renderStepContent();
};


window.addAllocRow = function(deptId) {
  const alloc = data.deptConfigs[deptId]?.gradeAllocation;
  if (!alloc) return;
  const last = alloc[alloc.length - 1];
  const defaults = { grade: last ? last.grade - 1 : 1, level: 1, title: '新進人員', headcount: 1, annualTotal: 400000, fixedRatio: 70, behaviorRatio: 10, performanceRatio: 20, subjects: { base: [{ name: '基本薪資', annual: null }], behavior: [{ name: '獎金', annual: null }], performance: [{ name: '績效', annual: null }] } };
  alloc.push(JSON.parse(JSON.stringify(defaults)));
  save();
  renderStepContent();
};

window.delAllocRow = function(deptId, idx) {
  const cfg = data.deptConfigs[deptId];
  if (!cfg || !cfg.gradeAllocation || cfg.gradeAllocation.length <= 1) return;
  if (!confirm('確定刪除此職等？')) return;
  cfg.gradeAllocation.splice(idx, 1);
  save();
  renderStepContent();
};

// ── Step 3: Drag reorder for cards ──
document.addEventListener('dragstart', e => {
  const head = e.target.closest('.str-head');
  if (head && head.draggable) e.dataTransfer.setData('text/plain', head.dataset.dragId);
});
document.addEventListener('dragover', e => {
  const card = e.target.closest('.str-card');
  if (card && e.dataTransfer.types.includes('text/plain')) { e.preventDefault(); card.style.borderTop = '2px solid #6366f1'; }
});
document.addEventListener('dragleave', e => {
  const card = e.target.closest('.str-card');
  if (card) card.style.borderTop = '';
});
document.addEventListener('drop', e => {
  e.preventDefault();
  const fromId = e.dataTransfer.getData('text/plain');
  const toCard = e.target.closest('.str-card');
  const fromCard = document.querySelector(`.str-card[data-dept-id="${fromId}"]`);
  if (toCard && fromCard && fromCard !== toCard) {
    const container = document.getElementById('strDeptList');
    const toId = toCard.dataset.deptId;
    const ids = [...container.querySelectorAll('.str-card')].map(el => el.dataset.deptId);
    const fromIdx = ids.indexOf(fromId);
    const toIdx = ids.indexOf(toId);
    if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
      const depts = data.departments;
      const fromDept = depts.find(d => d.id === fromId);
      if (fromDept) { depts.splice(depts.indexOf(fromDept), 1); depts.splice(toIdx, 0, fromDept); }
      save(); renderStepContent();
    }
  }
  document.querySelectorAll('.str-card').forEach(el => el.style.borderTop = '');
});

// ── Subjects Editor Modal ──
window.showSubjectsEditor = function(deptId) {
  const cfg = data.deptConfigs[deptId];
  if (!cfg) return;
  const d = data.departments.find(x => x.id === deptId);
  const subj = cfg.subjects || { base: [], behavior: [], performance: [], bonus: [], welfare: [], risks: [] };
  const catLabels = { base: '固定科目', behavior: '行為考核', performance: '績效考核', bonus: '分紅', welfare: '福利', risks: '風險條件' };
  let html = Object.keys(catLabels).map(cat => {
    const items = subj[cat] || [];
    return `<div style="margin-bottom:12px;">
      <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px;">${catLabels[cat]}</label>
      <div>${items.map((s, i) =>
        `<span style="display:inline-flex;align-items:center;gap:4px;margin:2px;padding:3px 8px;background:#f1f5f9;border-radius:4px;font-size:13px;">
          <input value="${typeof s === 'string' ? s : s.name || ''}" style="width:80px;border:none;background:transparent;font-size:13px;padding:2px;" onchange="window.updSubjItem('${deptId}','${cat}',${i},this.value)">
          <span style="cursor:pointer;color:#ef4444;font-size:14px;" onclick="window.delSubjItem('${deptId}','${cat}',${i})">×</span>
        </span>`
      ).join('')}</div>
      <button class="btn" style="font-size:12px;margin-top:4px;" onclick="window.addSubjItem('${deptId}','${cat}')">＋ 新增</button>
    </div>`;
  }).join('');
  const bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;display:flex;align-items:center;justify-content:center;';
  bg.onclick = e => { if (e.target === bg) bg.remove(); };
  bg.innerHTML = `<div style="background:#fff;border-radius:12px;padding:28px;min-width:520px;max-width:600px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2);" onclick="event.stopPropagation()">
    <h3 style="margin-bottom:16px;font-size:16px;font-weight:700;">✏ 編輯科目 — ${d ? d.name : ''}</h3>
    <p style="font-size:12px;color:#64748b;margin-bottom:12px;">編輯科目名稱，實際金額在各職等展開列中調整。分紅/福利為外加（視公司盈餘發放）。</p>
    ${html}
    <div style="margin-top:16px;text-align:right;"><button class="btn-primary btn-modal-done">完成</button></div>
  </div>`;
  document.body.appendChild(bg);
  bg.querySelector('.btn-modal-done').onclick = function() { bg.remove(); save(); render(); };
};
window.updSubjItem = function(deptId, cat, idx, val) {
  const cfg = data.deptConfigs[deptId];
  if (cfg) { if (!cfg.subjects) cfg.subjects = {}; if (!cfg.subjects[cat]) cfg.subjects[cat] = []; if (cfg.subjects[cat][idx] !== undefined) cfg.subjects[cat][idx] = val; save(); }
};
window.addSubjItem = function(deptId, cat) {
  const cfg = data.deptConfigs[deptId];
  if (cfg) { if (!cfg.subjects) cfg.subjects = {}; if (!cfg.subjects[cat]) cfg.subjects[cat] = []; cfg.subjects[cat].push('新項目'); save(); window.showSubjectsEditor(deptId); }
};
window.delSubjItem = function(deptId, cat, idx) {
  const cfg = data.deptConfigs[deptId];
  if (cfg && cfg.subjects && cfg.subjects[cat]) { cfg.subjects[cat].splice(idx, 1); save(); window.showSubjectsEditor(deptId); }
};

// ── Step 4: Grade Matrix ──
function step4HTML() {
  const depts = getDepts();
  const active = depts.filter(d => data.deptConfigs[d.id] && (data.headcounts[d.id] || 0) > 0);
  const matrix = data.gradeMatrix || DEFAULT_GRADE_MATRIX;
  const families = JOB_FAMILIES.filter(f => matrix[f] && matrix[f].length > 0);

  const famTables = families.map(family => {
    const grades = matrix[family];
    const pm = FAMILY_PAYMIX[family] || { fixed: 70, float: 30, desc: '' };
    const rows = grades.map(g => {
      const lvlRows = g.levels.map((l, li) => {
        const matched = [];
        active.forEach(d => {
          const alloc = data.deptConfigs[d.id]?.gradeAllocation || [];
          alloc.forEach(a => {
            if (a.grade === g.grade && a.level === l.level && a.headcount > 0) {
              matched.push(`${d.name} ${a.headcount}人`);
            }
          });
        });
        const markerHtml = matched.length ? `<span style="font-size:10px;color:#4338ca;">← ${matched.join('、')}</span>` : '';
        return `<tr>
          <td style="padding:4px 8px;font-size:12px;color:#475569;">${li === 0 ? `<strong>${g.title}</strong>` : ''}</td>
          <td style="padding:4px 8px;font-size:12px;text-align:center;">${li === 0 ? `${g.grade}等` : ''}</td>
          <td style="padding:4px 8px;font-size:12px;text-align:center;">${l.level}級</td>
          <td style="padding:4px 8px;font-size:12px;text-align:right;">NT$ ${l.min.toLocaleString()}</td>
          <td style="padding:4px 8px;font-size:12px;text-align:right;">NT$ ${l.max.toLocaleString()}</td>
          <td style="padding:4px 8px;font-size:11px;">${markerHtml}</td>
        </tr>`;
      }).join('');
      return lvlRows;
    }).join('');
    return `<div class="scard" style="margin-bottom:16px;">
      <div class="scard-title" style="display:flex;align-items:center;justify-content:space-between;">
        <span>${family}</span>
        <span style="font-size:11px;font-weight:400;color:#64748b;">固定 ${pm.fixed}% · 浮動 ${pm.float}% · ${pm.desc}</span>
      </div>
      <table class="r-table" style="font-size:13px;">
        <thead><tr><th style="width:20%;">職稱</th><th style="width:50px;">職等</th><th style="width:50px;">職級</th><th style="text-align:right;">下限</th><th style="text-align:right;">上限</th><th style="width:20%;">部門對應</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }).join('');
  return `<div class="scard">
    <div class="scard-title" style="display:flex;align-items:center;justify-content:space-between;">
      <span>❹ 職等職級對照</span>
      <button class="btn" onclick="window.showGradeMatrixEditor()">✏ 編輯所有級距</button>
    </div>
    <div class="scard-desc"><strong>職等</strong>（Grade）= 責任權限 · <strong>職級</strong>（Step）= 熟練度。各部門配置人數自動對應。</div>
    ${famTables}
  </div>${stepNav('下一步：總覽報表 ›', true)}`;
}

// ── Step 5: Report ──
function step5HTML() {
  const depts = getDepts();
  const active = depts.filter(d => data.deptConfigs[d.id] && (data.headcounts[d.id] || 0) > 0);
  if (active.length === 0) return `<div class="scard"><div class="scard-title">❺ 總覽報表</div><div class="empty">尚無資料</div></div>`;

  let totalHC2 = 0, totalF = 0, totalB = 0, totalP = 0, grand = 0;
  let rows = active.map(d => {
    const alloc = data.deptConfigs[d.id]?.gradeAllocation || [];
    const s = calcAllocSummary(alloc);
    if (s.totalHC === 0) return '';
    totalHC2 += s.totalHC;
    grand += s.deptTotal;
    // Compute category totals per department
    let dF = 0, dB = 0, dP = 0;
    alloc.forEach(a => {
      const r = calcAllocRow(a);
      const hc = a.headcount || 0;
      dF += r.targetBase * hc;
      dB += r.targetBehav * hc;
      dP += r.targetPerf * hc;
    });
    totalF += dF; totalB += dB; totalP += dP;
    const avgMonthly = Math.round(dF / 12 / s.totalHC);
    const avgAnnual = Math.round(s.deptTotal / s.totalHC);
    return `<tr><td><strong>${d.name}</strong></td><td>${s.totalHC}</td><td class="r">NT$ ${avgMonthly.toLocaleString()}</td>
      <td class="r">NT$ ${dF.toLocaleString()}</td><td class="r">NT$ ${dB.toLocaleString()}</td>
      <td class="r">NT$ ${dP.toLocaleString()}</td><td class="r">NT$ ${avgAnnual.toLocaleString()}</td>
      <td class="r">NT$ ${s.deptTotal.toLocaleString()}</td></tr>`;
  }).filter(Boolean).join('');

  const budgetAt = getAnnualTotal() * 10000;
  const usedPct = budgetAt > 0 ? Math.round(grand / budgetAt * 100) : 0;
  const bench = INDUSTRY_BENCHMARKS[data.industry];
  const health = calcHealth(data.laborRatio, bench);

  let snapRows = '';
  const snapshots = getSnapshots();
  if (snapshots.length > 0) {
    const s2 = snapshots.slice(-6);
    snapRows = `<div class="scard" style="margin-top:16px;">
      <div class="scard-title">📅 月份比較</div>
      <table class="r-table"><thead><tr><th>月份</th><th>總預算</th><th>總成本</th><th>佔用率</th><th>健康</th><th></th></tr></thead>
      <tbody>${s2.map((s, si) => {
        const idx = snapshots.length - 6 + si;
        const h = calcHealth(s.laborRatio, bench);
        return `<tr><td>${s.month}</td><td class="r">NT$ ${(s.annualTotal/10000).toLocaleString()} 萬</td><td class="r">NT$ ${(s.used/10000).toLocaleString()} 萬</td><td class="r">${s.pct}%</td><td style="color:${h.color};">${h.text}</td><td><button class="btn" style="font-size:10px;padding:1px 6px;color:#ef4444;" onclick="window.delSnapshot(${Math.max(0, idx)})">✕</button></td></tr>`;
      }).join('')}</tbody></table>
    </div>`;
  }

  const totalHC = getTotalHC();
  return `<div class="scard">
    <div class="scard-title" style="display:flex;align-items:center;justify-content:space-between;">
      <span>❺ 總覽報表</span>
      <div>
        <button class="btn" onclick="window.saveSnapshot()">📸 存檔比較</button>
        <button class="btn" onclick="window.exportExcel()">📥 Excel 匯出</button>
      </div>
    </div>
    <table class="r-table"><thead><tr><th>部門</th><th>人數</th><th class="r">平均月固定</th><th class="r">年固定</th><th class="r">行為(考核)</th><th class="r">績效</th><th class="r">平均年薪</th><th class="r">部門總成本</th></tr></thead>
      <tbody>${rows}
      <tr class="t-total"><td><strong>合計</strong></td><td><strong>${totalHC2}</strong></td><td class="r"><strong>NT$ ${Math.round(totalF/12).toLocaleString()}</strong></td>
        <td class="r"><strong>NT$ ${totalF.toLocaleString()}</strong></td><td class="r"><strong>NT$ ${totalB.toLocaleString()}</strong></td><td class="r"><strong>NT$ ${totalP.toLocaleString()}</strong></td>
        <td class="r"><strong>NT$ ${totalHC > 0 ? Math.round(grand/totalHC).toLocaleString() : 0}</strong></td><td class="r"><strong>NT$ ${grand.toLocaleString()}</strong></td></tr>
      </tbody></table>
    <div class="r-health" style="border-left-color:${health.color};color:${health.color};background:${health.bg}">${health.text} — ${data.industry} 建議 ${bench ? bench.laborRate : '—'}，目前設定 ${data.laborRatio}%，佔用 ${usedPct}%${bench && bench.note ? `<br><span style="font-weight:400;font-size:11px;">${bench.note}</span>` : ''}</div>
  </div>${snapRows}`;
}

// ── Debug: tets alloction ──
window.debugSalaryAlloc = function(deptId, idx) {
  const depts = getDepts();
  if (!deptId && depts.length) deptId = depts[0].id;
  const cfg = data.deptConfigs[deptId];
  if (!cfg) { console.log('【debugSalaryAlloc】No config for', deptId); return; }
  const alloc = cfg.gradeAllocation;
  if (!alloc || !alloc.length) { console.log('【debugSalaryAlloc】No gradeAllocation for', deptId); return; }
  if (idx === undefined) {
    console.log('【debugSalaryAlloc】All rows for', deptId);
    alloc.forEach((a, i) => window.debugSalaryAlloc(deptId, i));
    return;
  }
  const a = alloc[idx];
  console.log('【debugSalaryAlloc】Row', idx, 'for', deptId);
  console.log('  data.deptConfigs entry:', JSON.parse(JSON.stringify(a)));
  console.log('  calcAllocRow result:', calcAllocRow(a));
  const saved = JSON.parse(localStorage.getItem('salary_v2'));
  const savedRow = saved?.deptConfigs?.[deptId]?.gradeAllocation?.[idx];
  console.log('  localStorage entry:', savedRow ? JSON.parse(JSON.stringify(savedRow)) : 'NOT FOUND');
};

window.testSetRatio = function(deptId, idx) {
  const alloc = data.deptConfigs[deptId]?.gradeAllocation;
  if (!alloc || !alloc[idx]) { console.log('【testSetRatio】not found', deptId, idx); return; }
  const a = alloc[idx];
  console.log('【testSetRatio BEFORE】', { fixedRatio: a.fixedRatio, behaviorRatio: a.behaviorRatio, performanceRatio: a.performanceRatio, subjects: JSON.parse(JSON.stringify(a.subjects)) });
  a.fixedRatio = 30;
  a.behaviorRatio = 10;
  a.performanceRatio = 50;
  console.log('【testSetRatio AFTER data】', { fixedRatio: a.fixedRatio, behaviorRatio: a.behaviorRatio, performanceRatio: a.performanceRatio });
  save();
  renderStepContent();
  setTimeout(() => {
    const baseInput = document.querySelector(`[data-debug-dept="${deptId}"][data-debug-idx="${idx}"][data-debug-ratio="base"]`);
    const behavInput = document.querySelector(`[data-debug-dept="${deptId}"][data-debug-idx="${idx}"][data-debug-ratio="behavior"]`);
    const perfInput = document.querySelector(`[data-debug-dept="${deptId}"][data-debug-idx="${idx}"][data-debug-ratio="performance"]`);
    const saved = JSON.parse(localStorage.getItem('salary_v2'));
    const savedRow = saved?.deptConfigs?.[deptId]?.gradeAllocation?.[idx];
    const r = calcAllocRow(a);
    console.log('【testSetRatio DOM values】', {
      dom_fixed: baseInput ? baseInput.value : 'NOT FOUND',
      dom_behavior: behavInput ? behavInput.value : 'NOT FOUND',
      dom_performance: perfInput ? perfInput.value : 'NOT FOUND'
    });
    console.log('【testSetRatio 4-layer】', {
      dataState: { fr: a.fixedRatio, br: a.behaviorRatio, pr: a.performanceRatio },
      localStorage: savedRow ? { fr: savedRow.fixedRatio, br: savedRow.behaviorRatio, pr: savedRow.performanceRatio } : 'NOT FOUND',
      calcAllocRow: { fr: r.fr, br: r.br, pr: r.pr },
      dom: { base: baseInput?.value, behavior: behavInput?.value, performance: perfInput?.value }
    });
  }, 500);
};
function getSnapshots() {
  try { return JSON.parse(localStorage.getItem('salary_snapshots') || '[]'); } catch { return []; }
}
window.saveSnapshot = function() {
  const snapshots = getSnapshots();
  const now = new Date();
  const label = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}`;
  const depts = getDepts();
  let grand = 0;
  depts.forEach(d => {
    const alloc = data.deptConfigs[d.id]?.gradeAllocation || [];
    alloc.forEach(a => { grand += (a.annualTotal || 0) * (a.headcount || 0); });
  });
  const at = getAnnualTotal() * 10000;
  const pct = at > 0 ? Math.round(grand / at * 100) : 0;
  snapshots.push({ month: label, annualTotal: getAnnualTotal() * 10000, used: grand, pct, laborRatio: data.laborRatio });
  localStorage.setItem('salary_snapshots', JSON.stringify(snapshots));
  document.getElementById('planStatus').textContent = `📸 已存 ${snapshots.length} 筆快照（${label}）`;
  renderStepContent();
};

window.delSnapshot = function(idx) {
  if (!confirm('刪除這筆快照？')) return;
  const snapshots = getSnapshots();
  if (idx < 0 || idx >= snapshots.length) return;
  snapshots.splice(idx, 1);
  localStorage.setItem('salary_snapshots', JSON.stringify(snapshots));
  document.getElementById('planStatus').textContent = '🗑 已刪除';
  renderStepContent();
};

// ── Grade Matrix Management ──
window.updGradeMatrix = function(family, grade, lvlIdx, field, val) {
  if (!data.gradeMatrix) data.gradeMatrix = JSON.parse(JSON.stringify(DEFAULT_GRADE_MATRIX));
  const entry = data.gradeMatrix[family]?.find(g => Number(g.grade) === Number(grade));
  if (entry && entry.levels[lvlIdx]) { entry.levels[lvlIdx][field] = Math.max(0, parseInt(val) || 0); save(); }
};

window.showGradeMatrixEditor = function() {
  const matrix = data.gradeMatrix || DEFAULT_GRADE_MATRIX;
  const families = JOB_FAMILIES.filter(f => matrix[f] && matrix[f].length > 0);
  const oldOverlay = document.querySelector('[data-overlay="grade-editor"]');
  if (oldOverlay) oldOverlay.remove();
  const bg = document.createElement('div');
  bg.setAttribute('data-overlay', 'grade-editor');
  bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;display:flex;align-items:center;justify-content:center;';
  bg.onclick = e => { if (e.target === bg) { bg.remove(); save(); render(); } };
  const famHtml = families.map(family => {
    const grades = matrix[family];
    const pm = FAMILY_PAYMIX[family] || {};
    const rows = grades.map(g => {
      const lvlHtml = g.levels.map((l, li) => {
        const lWidth = g.levels.length > 1 ? Math.round((l.max - l.min) / l.min * 100) : 0;
        return `<tr>
          <td style="padding:4px 6px;font-size:12px;color:#475569;border-bottom:1px solid #f1f5f9;">${li === 0 ? `<input value="${g.title}" style="width:90px;padding:3px 6px;border:1px solid #e2e8f0;border-radius:4px;font-size:12px;" onchange="window.updGradeTitle('${family}',${g.grade},this.value)">` : ''}</td>
          <td style="padding:4px 6px;font-size:12px;text-align:center;border-bottom:1px solid #f1f5f9;">${li === 0 ? `<span style="background:#e8eaf6;padding:2px 8px;border-radius:4px;font-weight:600;">${g.grade}等</span>` : ''}</td>
          <td style="padding:4px 6px;text-align:center;border-bottom:1px solid #f1f5f9;"><input type="number" value="${l.level}" style="width:36px;padding:2px 4px;border:1px solid #e2e8f0;border-radius:4px;font-size:12px;text-align:center;" onchange="window.updGradeLevel('${family}',${g.grade},${li},this.value)"></td>
          <td style="padding:4px 6px;border-bottom:1px solid #f1f5f9;"><input type="number" value="${l.min}" style="width:65px;padding:3px 4px;border:1px solid #e2e8f0;border-radius:4px;font-size:12px;" onchange="window.updGradeMatrix('${family}',${g.grade},${li},'min',this.value)"></td>
          <td style="padding:4px 6px;border-bottom:1px solid #f1f5f9;"><input type="number" value="${l.max}" style="width:65px;padding:3px 4px;border:1px solid #e2e8f0;border-radius:4px;font-size:12px;" onchange="window.updGradeMatrix('${family}',${g.grade},${li},'max',this.value)"></td>
          <td style="font-size:11px;color:#94a3b8;border-bottom:1px solid #f1f5f9;">${g.levels.length > 1 ? `${lWidth}%` : '—'}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #f1f5f9;">
            ${li === 0 && g.levels.length > 1 ? `<button class="btn" style="font-size:9px;padding:1px 6px;" onclick="window.addGradeLevel('${family}',${g.grade})">＋</button>` : ''}
            ${g.levels.length > 1 && li === g.levels.length - 1 ? `<button class="btn" style="font-size:9px;padding:1px 6px;color:#ef4444;" onclick="window.delGradeLevel('${family}',${g.grade},${li})">✕</button>` : ''}
          </td>
        </tr>`;
      }).join('');
      return lvlHtml;
    }).join('');
    return `<div style="margin-bottom:16px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background:#f8fafc;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e2e8f0;">
        <strong style="font-size:14px;">${family}</strong>
        <span style="font-size:11px;color:#64748b;">固定 ${pm.fixed}% · 浮動 ${pm.float}%</span>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="border-bottom:2px solid #e2e8f0;">
          <th style="text-align:left;padding:4px 6px;font-size:11px;">職稱</th>
          <th style="padding:4px 6px;font-size:11px;">職等</th>
          <th style="padding:4px 6px;font-size:11px;">職級</th>
          <th style="padding:4px 6px;font-size:11px;">下限</th>
          <th style="padding:4px 6px;font-size:11px;">上限</th>
          <th style="padding:4px 6px;font-size:11px;">帶寬</th>
          <th style="padding:4px 6px;font-size:11px;"></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="padding:4px 8px;border-top:1px solid #e2e8f0;display:flex;gap:6px;">
        <button class="btn" style="font-size:10px;padding:2px 8px;" onclick="window.addGradeRow('${family}')">＋ 新增職等</button>
        <button class="btn" style="font-size:10px;padding:2px 8px;color:#ef4444;" onclick="window.delLastGrade('${family}')">✕ 刪末等</button>
      </div>
    </div>`;
  }).join('');
  bg.innerHTML = `<div style="background:#fff;border-radius:12px;padding:24px;min-width:600px;max-width:700px;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2);" onclick="event.stopPropagation()">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <h3 style="font-size:16px;font-weight:700;">📊 編輯職等職級對照表</h3>
      <div style="display:flex;gap:6px;">
        <button class="btn" onclick="window.addJobFamily()">＋ 新增職系</button>
        <button class="btn" onclick="bg.remove();save();render();" style="font-size:18px;padding:2px 12px;line-height:1;">✕</button>
      </div>
    </div>
    <div style="background:#f0f9ff;padding:8px 12px;border-radius:8px;margin-bottom:16px;font-size:11px;color:#1e40af;">每個職系獨立編輯。帶寬建議：基層20-30%、中階30-40%、高階40-60%。</div>
    ${famHtml}
    <div style="margin-top:16px;text-align:right;"><button class="btn-primary" id="gradeEditorDone">完成</button></div>
  </div>`;
  document.body.appendChild(bg);
  document.getElementById('gradeEditorDone').onclick = function() {
    bg.remove();
    save();
    render();
  };
};

window.updGradeTitle = function(family, grade, val) {
  if (!data.gradeMatrix) return;
  const entry = data.gradeMatrix[family]?.find(g => Number(g.grade) === Number(grade));
  if (entry) { entry.title = val; save(); }
};
window.updGradeLevel = function(family, grade, idx, val) {
  if (!data.gradeMatrix) return;
  const entry = data.gradeMatrix[family]?.find(g => Number(g.grade) === Number(grade));
  if (entry && entry.levels[idx]) { entry.levels[idx].level = Math.max(0, parseInt(val) || 0); save(); }
};
window.addGradeLevel = function(family, grade) {
  if (!data.gradeMatrix) data.gradeMatrix = JSON.parse(JSON.stringify(DEFAULT_GRADE_MATRIX));
  const entry = data.gradeMatrix[family]?.find(g => Number(g.grade) === Number(grade));
  if (entry) { const last = entry.levels[entry.levels.length - 1] || { min: 30000, max: 35000 }; entry.levels.push({ level: (last.level || 0) + 1, min: last.min + 2000, max: last.max + 3000 }); save(); window.showGradeMatrixEditor(); }
};
window.delGradeLevel = function(family, grade, idx) {
  if (!data.gradeMatrix) return;
  const entry = data.gradeMatrix[family]?.find(g => Number(g.grade) === Number(grade));
  if (entry && entry.levels.length > 1) { entry.levels.splice(idx, 1); save(); window.showGradeMatrixEditor(); }
};
window.addGradeRow = function(family) {
  if (!data.gradeMatrix) data.gradeMatrix = JSON.parse(JSON.stringify(DEFAULT_GRADE_MATRIX));
  const arr = data.gradeMatrix[family];
  if (arr && arr.length) { const last = arr[arr.length - 1]; const newGrade = last.grade + 1; arr.push({ grade: newGrade, title: `職等${newGrade}`, levels: last.levels.map(l => ({ level: l.level, min: l.min + 3000, max: l.max + 5000 })) }); save(); window.showGradeMatrixEditor(); }
};
window.delLastGrade = function(family) {
  if (!data.gradeMatrix || !data.gradeMatrix[family] || data.gradeMatrix[family].length <= 1) return;
  if (!confirm(`確定刪除 ${family} 的末等？`)) return;
  data.gradeMatrix[family].pop(); save(); window.showGradeMatrixEditor();
};
window.addJobFamily = function() {
  const name = prompt('新職系名稱：');
  if (!name) return;
  if (!data.gradeMatrix) data.gradeMatrix = JSON.parse(JSON.stringify(DEFAULT_GRADE_MATRIX));
  if (data.gradeMatrix[name]) { alert('職系已存在'); return; }
  const firstFam = Object.keys(data.gradeMatrix)[0] || '管理系';
  data.gradeMatrix[name] = JSON.parse(JSON.stringify(data.gradeMatrix[firstFam]));
  save(); window.showGradeMatrixEditor();
};

// ── Sidebar ──
function renderSidebar() {
  const el = document.getElementById('sidebarOverview');
  if (!data || !data.industry) { el.innerHTML = '<div class="sbo"><div class="sbo-title">📊 預算概覽</div><div class="empty" style="padding:20px 0;">請先選擇產業</div></div>'; return; }
  const depts = getDepts();
  const at = getAnnualTotal();
  const totalHC = getTotalHC();
  let allocatedTotal = 0, deptLines = '';
  depts.forEach(d => {
    const alloc = data.deptConfigs[d.id]?.gradeAllocation || [];
    const s = alloc.length ? calcAllocSummary(alloc) : { totalHC: 0, deptTotal: 0 };
    if (s.totalHC > 0) allocatedTotal += s.deptTotal;
    deptLines += `<div class="sbo-row"><span class="sbo-lbl">${d.name}</span><span class="sbo-val">${s.totalHC > 0 ? `NT$${Math.round(s.deptTotal/10000).toLocaleString()}萬` : '—'}</span></div>`;
  });
  const budgetAt = at * 10000;
  const pct = budgetAt > 0 ? Math.min(100, Math.round(allocatedTotal / budgetAt * 100)) : 0;
  const barClass = pct <= 80 ? 'good' : pct <= 100 ? 'warn' : 'danger';
  const barLabel = pct <= 80 ? '預算餘裕' : pct <= 100 ? '預算用滿' : '超出預算';
  const bench = INDUSTRY_BENCHMARKS[data.industry];
  const health = calcHealth(data.laborRatio, bench);
  el.innerHTML = `<div class="sbo">
    <div class="sbo-title">📊 預算概覽</div>
    <div class="sbo-row"><span class="sbo-lbl">年總預算</span><span class="sbo-val">NT$ ${at.toLocaleString()} 萬</span></div>
    <div class="sbo-row"><span class="sbo-lbl">總人數</span><span class="sbo-val">${totalHC} 人</span></div>
    <div class="sbo-row"><span class="sbo-lbl">已分配</span><span class="sbo-val">NT$ ${Math.round(allocatedTotal/10000).toLocaleString()} 萬</span></div>
    <div class="sbo-bar"><div class="sbo-bar-fill ${barClass}" style="width:${pct}%"></div></div>
    <div class="sbo-bar-label">${pct}% ${barLabel}</div>
    ${deptLines}
    <div class="sbo-health" style="background:${health.bg};color:${health.color};">${health.text} — ${data.industry} 建議 ${bench ? bench.laborRate : '—'}，目前 ${data.laborRatio}%</div>
  </div>`;
}

// ── Plan Management ──
function renderPlanList() {
  const el = document.getElementById('planSelector');
  if (!el) return;
  const plans = getPlanList();
  el.innerHTML = `<select onchange="window.loadPlan(this.value)" style="padding:6px 10px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:13px;min-width:120px;">
    <option value="">${plans.length === 0 ? '— 尚未儲存方案 —' : '— 切換方案 —'}</option>
    ${plans.map((p, i) => `<option value="${i}" ${p.name === data?.planName ? 'selected' : ''}>${p.name}</option>`).join('')}
  </select>
  <button class="btn" onclick="window.saveAsPlan()">💾 另存方案</button>
  <button class="btn" onclick="window.deletePlan()" style="color:#ef4444;">🗑 刪除</button>
  ${curUser ? '<button class="btn" onclick="window.syncToSupabase()">☁ 同步</button>' : ''}
  <span id="planStatus" style="font-size:12px;color:#94a3b8;margin-left:8px;"></span>`;
}
function getPlanListKey() { return 'salary_plan_list_v2'; }
function getPlanList() { try { return JSON.parse(localStorage.getItem(getPlanListKey()) || '[]'); } catch { return []; } }
function setPlanList(list) { localStorage.setItem(getPlanListKey(), JSON.stringify(list)); renderPlanList(); }
window.saveAsPlan = function() {
  const name = prompt('方案名稱：', data.planName || '新方案');
  if (!name) return;
  const plans = getPlanList();
  const idx = plans.findIndex(p => p.name === name);
  const entry = { name, data: JSON.parse(JSON.stringify(data)), updatedAt: new Date().toISOString() };
  if (idx >= 0) plans[idx] = entry; else plans.push(entry);
  data.planName = name;
  setPlanList(plans); save();
  document.getElementById('planStatus').textContent = `✅ 已儲存「${name}」`;
};
window.loadPlan = function(val) {
  if (val === '') return;
  const plans = getPlanList();
  const idx = parseInt(val);
  if (!plans[idx]) return;
  data = JSON.parse(JSON.stringify(plans[idx].data));
  migrateData();
  data.planName = plans[idx].name;
  currentStep = data.step || 1;
  save(); renderIndustries(); render(); renderPlanList();
  document.getElementById('planStatus').textContent = `📂 已載入「${plans[idx].name}」`;
};
window.deletePlan = function() {
  const plans = getPlanList();
  if (plans.length === 0) return;
  const names = plans.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
  const idx = parseInt(prompt(`選擇要刪除的方案編號：\n${names}`)) - 1;
  if (isNaN(idx) || !plans[idx]) return;
  if (!confirm(`確定刪除「${plans[idx].name}」？`)) return;
  plans.splice(idx, 1); setPlanList(plans);
  document.getElementById('planStatus').textContent = '🗑 已刪除';
};

// ── Supabase Sync ──
window.syncToSupabase = async function() {
  const status = document.getElementById('planStatus');
  status.textContent = '⏳ 同步中...';
  try {
    const plans = getPlanList();
    for (const p of plans) { await supabaseSave(null, p.name, '', p.data); }
    status.textContent = `☁ 已同步 ${plans.length} 筆至雲端`;
  } catch (e) { status.textContent = '⚠ 同步失敗：' + e.message; }
};

// ── Excel Export ──
window.exportExcel = function() {
  const depts = getDepts();
  const active = depts.filter(d => data.deptConfigs[d.id] && (data.headcounts[d.id] || 0) > 0);
  let html = `<table><tr><th>部門</th><th>職稱</th><th>人數</th><th>年薪總包</th><th>固定%</th><th>行為%</th><th>績效%</th><th>年固定</th><th>年行為</th><th>年績效</th><th>月固定</th><th>部門小計</th></tr>`;
  active.forEach(d => {
    const alloc = data.deptConfigs[d.id]?.gradeAllocation || [];
    alloc.forEach(a => {
      html += `<tr><td>${d.name}</td><td>${a.title}</td><td>${a.headcount}</td><td>${a.annualTotal}</td><td>${a.fixedRatio}</td><td>${a.behaviorRatio}</td><td>${a.performanceRatio}</td><td>${a.fixedAnnual}</td><td>${a.behaviorAnnual}</td><td>${a.perfAnnual}</td><td>${a.monthlyBase}</td><td>${(a.annualTotal * a.headcount)}</td></tr>`;
    });
  });
  html += `</table>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `薪酬結構_${data.industry}_${new Date().toISOString().slice(0,10)}.xls`;
  a.click();
  URL.revokeObjectURL(a.href);
};

// ── PWA Setup ──
function setupPWA() { if ('serviceWorker' in navigator) { navigator.serviceWorker.register('./sw.js').catch(() => {}); } }

if (document.getElementById('planSelector')) renderPlanList();
setupPWA();

window.exportCSV = function() {
  if (!data) return;
  const depts = getDepts();
  const active = depts.filter(d => data.deptConfigs[d.id] && (data.headcounts[d.id] || 0) > 0);
  let csv = '\uFEFF部門,職稱,人數,年薪總包,固定%,行為%,績效%,年固定,年行為,年績效,月固定,部門小計\n';
  active.forEach(d => {
    const alloc = data.deptConfigs[d.id]?.gradeAllocation || [];
    alloc.forEach(a => { csv += `${d.name},${a.title},${a.headcount},${a.annualTotal},${a.fixedRatio},${a.behaviorRatio},${a.performanceRatio},${a.fixedAnnual},${a.behaviorAnnual},${a.perfAnnual},${a.monthlyBase},${a.annualTotal * a.headcount}\n`; });
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `薪酬結構_${data.industry}.csv`;
  a.click();
};
window.exportPDF = function() { window.print(); };
