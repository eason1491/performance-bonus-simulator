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
  Object.keys(data.deptConfigs || {}).forEach(id => {
    const cfg = data.deptConfigs[id];
    if (cfg && !cfg.gradeAllocation) {
      const d = data.departments.find(x => x.id === id);
      const hc = data.headcounts[id] || 1;
      const alloc = createDefaultAllocation(hc, d ? d.name : '部門', cfg.type || '平路型', data.gradeMatrix);
      if (alloc.length) cfg.gradeAllocation = alloc;
      else cfg.gradeAllocation = [{ grade: -1, level: 1, title: '人員', headcount: hc, annualTotal: cfg.annualTotal || 600000, fixedRatio: cfg.fixedRatio || 70, behaviorRatio: cfg.behaviorRatio || 10, performanceRatio: cfg.performanceRatio || 20, fixedAnnual: cfg.fixedAnnual || 420000, behaviorAnnual: cfg.behaviorAnnual || 60000, perfAnnual: cfg.perfAnnual || 120000, monthlyBase: cfg.monthlyBase || 35000, subjects: { base: [{ name: '基本薪資', amount: cfg.fixedAnnual || 420000 }], behavior: [{ name: '獎金', amount: cfg.behaviorAnnual || 60000 }], performance: [{ name: '績效', amount: cfg.perfAnnual || 120000 }] } }];
    }
  });
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

function calcAllocSummary(alloc) {
  let totalHC = 0, totalAnnual = 0, totalF = 0, totalB = 0, totalP = 0;
  (alloc || []).forEach(a => {
    totalHC += a.headcount || 0;
    totalAnnual += (a.annualTotal || 0) * (a.headcount || 0);
    totalF += (a.fixedAnnual || 0) * (a.headcount || 0);
    totalB += (a.behaviorAnnual || 0) * (a.headcount || 0);
    totalP += (a.perfAnnual || 0) * (a.headcount || 0);
  });
  const deptTotal = totalAnnual;
  const avgAnnual = totalHC > 0 ? Math.round(totalAnnual / totalHC) : 0;
  const avgF = totalHC > 0 ? Math.round(totalF / totalHC) : 0;
  const avgB = totalHC > 0 ? Math.round(totalB / totalHC) : 0;
  const avgP = totalHC > 0 ? Math.round(totalP / totalHC) : 0;
  const fr = deptTotal > 0 ? Math.round(totalF / deptTotal * 100) : 0;
  const br = deptTotal > 0 ? Math.round(totalB / deptTotal * 100) : 0;
  const pr = deptTotal > 0 ? Math.round(totalP / deptTotal * 100) : 0;
  return { totalHC, deptTotal, totalAnnual, totalF, totalB, totalP, avgAnnual, avgF, avgB, avgP, fr, br, pr };
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
    cfg2.gradeAllocation = [{ grade: -1, level: 1, title: d.name + '人員', headcount: hc, annualTotal: 600000, fixedRatio: 70, behaviorRatio: 10, performanceRatio: 20, fixedAnnual: 420000, behaviorAnnual: 60000, perfAnnual: 120000, monthlyBase: 35000, subjects: { base: [{ name: '基本薪資', amount: 420000 }], behavior: [{ name: '獎金', amount: 60000 }], performance: [{ name: '績效', amount: 120000 }] } }];
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
  if (n < 1 || n > 5) return;
  if (n > currentStep + 1 && currentStep < 5) return;
  currentStep = n;
  save();
  render();
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
      <td><input type="number" value="${hc}" min="0" max="500" onchange="window.updS2HC('${d.id}',this.value)" style="width:64px;padding:6px 8px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:14px;text-align:center;"></td>
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

    // Build allocation table rows
    const expandedState = window._expanded || {};
    const allocRows = alloc.map((a, ai) => {
      const isOpen = expandedState[`${d.id}_${ai}`];
      const jf = getJobFamilyForDept(d.type);
      const grades = (data.gradeMatrix || DEFAULT_GRADE_MATRIX)[jf] || [];
      const titleOptions = grades.map(g => `<option value="${g.grade}" ${g.grade === a.grade ? 'selected' : ''}>${g.title} ${g.grade}等</option>`).join('');
      const recalc = (annual, fr, br, pr) => {
        const fa = Math.round(annual * fr / 100);
        const ba = Math.round(annual * br / 100);
        const pa = Math.round(annual * pr / 100);
        const mb = Math.round(fa / 12);
        return { fa, ba, pa, mb };
      };

      return `<div style="border-bottom:1px solid #f1f5f9;">
        <div class="alloc-summary" style="display:grid;grid-template-columns:30px 120px 50px 110px 55px 55px 55px 50px auto;align-items:center;gap:4px;padding:6px 8px;font-size:13px;cursor:pointer;" onclick="window.toggleAlloc('${d.id}',${ai})">
          <span style="color:#94a3b8;font-size:12px;">${isOpen ? '▾' : '▸'}</span>
          <select onchange="window.updAllocCell('${d.id}',${ai},'grade',this.value);event.stopPropagation();" style="font-size:12px;padding:2px 4px;border:1px solid #e2e8f0;border-radius:4px;width:110px;" onclick="event.stopPropagation()">${titleOptions}</select>
          <input type="number" value="${a.headcount}" min="1" max="99" style="width:40px;padding:2px 4px;border:1px solid #e2e8f0;border-radius:4px;font-size:12px;text-align:center;" onchange="window.updAllocCell('${d.id}',${ai},'hc',this.value);event.stopPropagation();" onclick="event.stopPropagation()">
          <input type="number" value="${a.annualTotal}" step="10000" min="100000" max="5000000" style="width:100px;padding:2px 4px;border:1px solid #e2e8f0;border-radius:4px;font-size:12px;" onchange="window.updAllocCell('${d.id}',${ai},'annual',this.value);event.stopPropagation();" onclick="event.stopPropagation()">
          <input type="number" value="${a.fixedRatio}" min="0" max="100" style="width:45px;padding:2px 4px;border:1px solid #e2e8f0;border-radius:4px;font-size:12px;text-align:center;" onchange="window.updAllocCell('${d.id}',${ai},'fr',this.value);event.stopPropagation();" onclick="event.stopPropagation()">
          <input type="number" value="${a.behaviorRatio}" min="0" max="100" style="width:45px;padding:2px 4px;border:1px solid #e2e8f0;border-radius:4px;font-size:12px;text-align:center;" onchange="window.updAllocCell('${d.id}',${ai},'br',this.value);event.stopPropagation();" onclick="event.stopPropagation()">
          <input type="number" value="${a.performanceRatio}" min="0" max="100" style="width:45px;padding:2px 4px;border:1px solid #e2e8f0;border-radius:4px;font-size:12px;text-align:center;" onchange="window.updAllocCell('${d.id}',${ai},'pr',this.value);event.stopPropagation();" onclick="event.stopPropagation()">
          <span style="font-size:12px;text-align:right;">NT$ ${(a.annualTotal * a.headcount).toLocaleString()}</span>
          ${ai > 0 ? `<button class="btn" style="font-size:9px;padding:0 6px;color:#ef4444;" onclick="window.delAllocRow('${d.id}',${ai});event.stopPropagation();">✕</button>` : '<span></span>'}
        </div>
        ${isOpen ? `<div class="alloc-detail" style="background:#fafbff;padding:8px 12px 8px 42px;font-size:12px;">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
            ${['base','behavior','performance'].map(cat => {
              const catLabel = { base: '固定', behavior: '行為', performance: '績效' }[cat];
              const catVal = { base: a.fixedAnnual, behavior: a.behaviorAnnual, performance: a.perfAnnual }[cat];
              const items = (a.subjects && a.subjects[cat]) || [];
              return `<div>
                <div style="font-weight:600;color:#475569;margin-bottom:4px;font-size:11px;">${catLabel} NT$ ${catVal.toLocaleString()}</div>
                ${items.map((s, si) => `<div style="display:flex;align-items:center;gap:4px;margin:2px 0;">
                  <input value="${s.name}" style="width:70px;padding:2px 4px;border:1px solid #e2e8f0;border-radius:3px;font-size:11px;" onchange="window.updAllocSubj('${d.id}',${ai},'${cat}',${si},'name',this.value)">
                  <input type="number" value="${s.amount}" style="width:60px;padding:2px 4px;border:1px solid #e2e8f0;border-radius:3px;font-size:11px;" onchange="window.updAllocSubj('${d.id}',${ai},'${cat}',${si},'amount',this.value)">
                  <span style="cursor:pointer;color:#ef4444;font-size:14px;" onclick="window.delAllocSubj('${d.id}',${ai},'${cat}',${si})">×</span>
                </div>`).join('')}
                <button class="btn" style="font-size:10px;padding:1px 6px;margin-top:2px;" onclick="window.addAllocSubj('${d.id}',${ai},'${cat}')">＋</button>
              </div>`;
            }).join('')}
          </div>
          <div style="display:flex;gap:8px;margin-top:6px;">
            <span style="font-size:10px;color:#94a3b8;">月固定 NT$ ${a.monthlyBase.toLocaleString()}／人</span>
            <span style="font-size:10px;color:#94a3b8;">固定+行為+績效合計 $${(a.fixedRatio + a.behaviorRatio + a.performanceRatio)}%</span>
          </div>
        </div>` : ''}
      </div>`;
    }).join('');

    const totRow = summary.totalHC > 0 ? `<div style="display:grid;grid-template-columns:30px 120px 50px 110px 55px 55px 55px 50px auto;align-items:center;gap:4px;padding:8px;font-size:13px;font-weight:700;background:#f8fafc;border-top:2px solid #0f172a;">
      <span></span><span>合計</span>
      <span style="text-align:center;">${summary.totalHC}</span>
      <span></span>
      <span style="text-align:center;">${summary.fr}%</span>
      <span style="text-align:center;">${summary.br}%</span>
      <span style="text-align:center;">${summary.pr}%</span>
      <span style="text-align:right;">NT$ ${summary.deptTotal.toLocaleString()}</span>
      <span></span>
    </div>` : '';

    return `<div class="str-card" data-dept-id="${d.id}" style="border-color:${borderColor};${usage > 100 ? 'box-shadow:0 0 0 2px #ef4444;' : ''}">
      <div class="str-head" draggable="true" data-drag-id="${d.id}" style="cursor:grab;">
        <span style="color:#94a3b8;font-size:14px;user-select:none;">⠿</span>
        <span class="s-name">${d.name}</span>
        <span style="font-size:11px;padding:3px 8px;border-radius:4px;background:${tClass==='up'?'#e3f2fd':tClass==='flat'?'#f3e5f5':'#e0f2fe'};color:#1e293b;">${d.type}</span>
        <span class="s-hc">${summary.totalHC}人</span>
        <span class="s-budget">預算 NT$ ${Math.round(db/10000).toLocaleString()} 萬</span>
        <span style="font-size:12px;font-weight:600;color:${usgColor};">${usgLabel} ${usage}%</span>
      </div>
      <div class="str-body" style="padding:0;">
        <div style="display:grid;grid-template-columns:30px 120px 50px 110px 55px 55px 55px 50px auto;align-items:center;gap:4px;padding:6px 8px;font-size:11px;color:#64748b;background:#fafbff;border-bottom:1px solid #e2e8f0;">
          <span></span><span>職稱</span><span style="text-align:center;">人</span><span>年薪總包</span><span style="text-align:center;">固定%</span><span style="text-align:center;">行為%</span><span style="text-align:center;">績效%</span><span style="text-align:right;">小計</span>
        </div>
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
    if (g) {
      a.grade = g.grade;
      a.title = g.title;
      a.level = g.levels[Math.floor(g.levels.length / 2)]?.level || 1;
    }
  } else if (field === 'hc') { a.headcount = Math.max(1, num); }
  else if (field === 'annual') { a.annualTotal = Math.max(100000, num); }
  else if (field === 'fr') {
    a.fixedRatio = Math.min(100, Math.max(0, num));
    const remain = 100 - a.fixedRatio;
    const tf = a.behaviorRatio + a.performanceRatio;
    if (tf > 0) { a.behaviorRatio = Math.round(remain * a.behaviorRatio / tf); a.performanceRatio = remain - a.behaviorRatio; }
    else { a.behaviorRatio = Math.round(remain * 0.5); a.performanceRatio = remain - a.behaviorRatio; }
  } else if (field === 'br') {
    a.behaviorRatio = Math.min(100 - a.fixedRatio, Math.max(0, num));
    a.performanceRatio = 100 - a.fixedRatio - a.behaviorRatio;
  } else if (field === 'pr') {
    a.performanceRatio = Math.min(100 - a.fixedRatio, Math.max(0, num));
    a.behaviorRatio = 100 - a.fixedRatio - a.performanceRatio;
  }
  a.fixedAnnual = Math.round(a.annualTotal * a.fixedRatio / 100);
  a.behaviorAnnual = Math.round(a.annualTotal * a.behaviorRatio / 100);
  a.perfAnnual = Math.round(a.annualTotal * a.performanceRatio / 100);
  a.monthlyBase = Math.round(a.fixedAnnual / 12);
  // Recalculate subjects amounts proportionally
  ['base','behavior','performance'].forEach(cat => {
    const total = { base: a.fixedAnnual, behavior: a.behaviorAnnual, performance: a.perfAnnual }[cat];
    const items = a.subjects && a.subjects[cat];
    if (items && items.length) {
      const each = Math.round(total / items.length);
      items.forEach((item, i) => { item.amount = i === items.length - 1 ? total - each * (items.length - 1) : each; });
    }
  });
  save();
  renderStepContent();
};

window.updAllocSubj = function(deptId, idx, cat, si, field, val) {
  const alloc = data.deptConfigs[deptId]?.gradeAllocation;
  if (!alloc || !alloc[idx] || !alloc[idx].subjects || !alloc[idx].subjects[cat]) return;
  alloc[idx].subjects[cat][si][field] = field === 'amount' ? (parseInt(val) || 0) : val;
  save();
};

window.addAllocSubj = function(deptId, idx, cat) {
  const alloc = data.deptConfigs[deptId]?.gradeAllocation;
  if (!alloc || !alloc[idx]) return;
  if (!alloc[idx].subjects) alloc[idx].subjects = { base: [], behavior: [], performance: [] };
  if (!alloc[idx].subjects[cat]) alloc[idx].subjects[cat] = [];
  alloc[idx].subjects[cat].push({ name: '新科目', amount: 0 });
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
  const defaults = { grade: last ? last.grade - 1 : 1, level: 1, title: '新進人員', headcount: 1, annualTotal: 400000, fixedRatio: 80, behaviorRatio: 10, performanceRatio: 10, fixedAnnual: 320000, behaviorAnnual: 40000, perfAnnual: 40000, monthlyBase: 26667, subjects: { base: [{ name: '基本薪資', amount: 320000 }], behavior: [{ name: '獎金', amount: 40000 }], performance: [{ name: '績效', amount: 40000 }] } };
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

  let totalF = 0, totalB = 0, totalP = 0, grand = 0;
  let rows = active.map(d => {
    const alloc = data.deptConfigs[d.id]?.gradeAllocation || [];
    const s = calcAllocSummary(alloc);
    if (s.totalHC === 0) return '';
    totalF += s.totalF; totalB += s.totalB; totalP += s.totalP; grand += s.deptTotal;
    return `<tr><td><strong>${d.name}</strong></td><td>${s.totalHC}</td><td class="r">NT$ ${s.avgF.toLocaleString()}</td>
      <td class="r">NT$ ${s.totalF.toLocaleString()}</td><td class="r">NT$ ${s.totalB.toLocaleString()}</td>
      <td class="r">NT$ ${s.totalP.toLocaleString()}</td><td class="r">NT$ ${s.avgAnnual.toLocaleString()}</td>
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
      <tr class="t-total"><td><strong>合計</strong></td><td><strong>${totalHC}</strong></td><td class="r"><strong>NT$ ${Math.round(totalF/12).toLocaleString()}</strong></td>
        <td class="r"><strong>NT$ ${totalF.toLocaleString()}</strong></td><td class="r"><strong>NT$ ${totalB.toLocaleString()}</strong></td><td class="r"><strong>NT$ ${totalP.toLocaleString()}</strong></td>
        <td class="r"><strong>NT$ ${totalHC > 0 ? Math.round(grand/totalHC).toLocaleString() : 0}</strong></td><td class="r"><strong>NT$ ${grand.toLocaleString()}</strong></td></tr>
      </tbody></table>
    <div class="r-health" style="border-left-color:${health.color};color:${health.color};background:${health.bg}">${health.text} — ${data.industry} 建議 ${bench ? bench.laborRate : '—'}，目前設定 ${data.laborRatio}%，佔用 ${usedPct}%${bench && bench.note ? `<br><span style="font-weight:400;font-size:11px;">${bench.note}</span>` : ''}</div>
  </div>${snapRows}`;
}

// ── Snapshots ──
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
    const s = calcAllocSummary(alloc);
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
