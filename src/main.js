import { signInWithGoogle, signOut, onAuthChange, getCurrentUser, savePlan as supabaseSave } from './auth.js';
import { INDUSTRIES, DEPT_TYPE, DEPT_RATIOS, DEPT_SUBJECTS, INDUSTRY_BENCHMARKS, ONE_LINERS, ALL_DEPTS, JOB_TYPES, TYPE_RATIOS, TYPE_SUBJECTS, DEFAULT_GRADES, RANK_TITLES, JOB_FAMILIES, DEFAULT_GRADE_MATRIX, getIndustryDepts, genDeptId, isKnownDept, getDeptRatios, getDeptSubjects, createDeptConfig, calcHealth, parseRange, defaultData } from './data.js';

let curUser = null;
let currentStep = 1;
let data = null;
const STORAGE_KEY = 'salary_v2';

// ── Auth ──
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

// ── Init ──
function init() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      data = JSON.parse(saved);
      if (data && data.industry && data.departments) {
        renderIndustries();
        currentStep = data.step || 1;
        render();
        renderPlanList();
        return;
      }
    } catch(e) {}
  }
  renderIndustries();
}

function save() {
  if (data) { data.step = currentStep; localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
}

// ── Industry chips ──
function renderIndustries() {
  document.getElementById('industryChips').innerHTML =
    Object.keys(INDUSTRIES).map(ind =>
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

// ── Render ──
function render() {
  if (!data) { document.getElementById('stepContent').innerHTML = '<div class="empty">請先選擇產業類別</div>'; renderSidebar(); return; }
  renderSteps();
  renderStepContent();
  renderSidebar();
}

// ── Helpers ──
function getDepts() {
  return (data.departments || []).filter(d => d.enabled !== false);
}

function getAnnualTotal() {
  return data.monthlyRevenue * 12 * data.laborRatio / 100;
}

function getTotalHC() {
  return getDepts().reduce((s, d) => s + (data.headcounts[d.id] || 0), 0);
}

function getDeptBudget(d) {
  const totalHC = getTotalHC();
  const hc = data.headcounts[d.id] || 0;
  return totalHC > 0 ? Math.round(getAnnualTotal() * hc / totalHC) : 0;
}

function getOrCreateConfig(d, pp) {
  if (!data.deptConfigs[d.id]) {
    data.deptConfigs[d.id] = createDeptConfig(d.id, d.name, d.type, pp);
  }
  return data.deptConfigs[d.id];
}

// ── Step Indicator ──
function renderSteps() {
  const labels = ['設定總預算', '配置部門人數', '薪酬結構設計', '總覽報表'];
  const states = ['pending','pending','pending','pending'];
  for (let i = 0; i < currentStep; i++) states[i] = 'done';
  states[currentStep - 1] = 'active';
  document.getElementById('stepIndicator').innerHTML = states.map((s, i) => {
    const n = i + 1;
    const icons = ['❶','❷','❸','❹'];
    return `${i > 0 ? '<span class="step-arrow">›</span>' : ''}<div class="step ${s}" onclick="window.goStep(${n})" style="cursor:pointer;"><div class="step-num">${icons[i]}</div><div class="step-label">${labels[i]}</div></div>`;
  }).join('');
}

window.goStep = function(n) {
  if (n < 1 || n > 4) return;
  if (n > currentStep + 1 && currentStep < 4) return;
  currentStep = n;
  save();
  render();
};

// ── Step Content ──
function renderStepContent() {
  const el = document.getElementById('stepContent');
  if (currentStep === 1) el.innerHTML = step1HTML();
  else if (currentStep === 2) el.innerHTML = step2HTML();
  else if (currentStep === 3) el.innerHTML = step3HTML();
  else if (currentStep === 4) el.innerHTML = step4HTML();
  attachStepEvents();
}

function stepNav(nextLabel, allowNext) {
  return `<div class="step-nav">
    <button class="btn" onclick="window.goStep(${currentStep - 1})" ${currentStep <= 1 ? 'disabled' : ''}>‹ 上一步</button>
    <button class="btn-primary" onclick="window.goStep(${currentStep + 1})" ${!allowNext ? 'disabled' : ''}>${nextLabel} ›</button>
  </div>`;
}

function attachStepEvents() {}

// ── Step 1: Budget ──
function step1HTML() {
  const bench = INDUSTRY_BENCHMARKS[data.industry];
  const range = bench ? parseRange(bench.laborRate) : { min: 20, max: 40 };
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
    <div class="scard-desc">填入各部門人數，預算按人數比例自動分配（總 ${totalHC} 人）。人數為 0 則不分配預算。可用拖曳 ✦ 調整順序。</div>
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
  const rows = depts.map((d, i) => {
    const tClass = d.type === '上山型' ? 'up' : d.type === '平路型' ? 'flat' : 'down';
    return `<tr>
      <td><input value="${d.name}" onchange="window.renameDept('${d.id}',this.value)" style="width:120px;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;"></td>
      <td>
        <select onchange="window.changeDeptType('${d.id}',this.value)" style="padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;">
          ${JOB_TYPES.map(t => `<option value="${t}" ${t === d.type ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </td>
      <td><span style="font-size:10px;padding:2px 6px;border-radius:4px;background:${tClass==='up'?'#e3f2fd':tClass==='flat'?'#f3e5f5':'#e0f2fe'};">${d.type}</span></td>
      <td><label><input type="checkbox" ${d.enabled !== false ? 'checked' : ''} onchange="window.toggleDept('${d.id}',this.checked)"> 啟用</label></td>
      <td><button class="btn" onclick="window.deleteDept('${d.id}')" style="color:#ef4444;">刪除</button></td>
    </tr>`;
  }).join('');
  bg.innerHTML = `<div style="background:#fff;border-radius:12px;padding:28px;min-width:580px;max-width:700px;box-shadow:0 20px 60px rgba(0,0,0,.2);" onclick="event.stopPropagation()">
    <h3 style="margin-bottom:16px;font-size:16px;font-weight:700;">管理部門</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="border-bottom:2px solid #e2e8f0;"><th style="text-align:left;padding:8px;">部門名稱</th><th style="text-align:left;padding:8px;">型態</th><th style="padding:8px;"></th><th style="padding:8px;"></th><th style="padding:8px;"></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:12px;display:flex;gap:8px;">
      <select id="newDeptType" style="padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:6px;">
        ${JOB_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
      </select>
      <button class="btn-primary" onclick="window.addDept()">＋ 新增部門</button>
    </div>
    <div style="margin-top:16px;text-align:right;"><button class="btn-primary" onclick="this.closest('div[style]').parentElement.remove();save();render();">完成</button></div>
  </div>`;
  document.body.appendChild(bg);
};

window.renameDept = function(id, name) {
  const d = data.departments.find(x => x.id === id);
  if (d) { d.name = name || d.name; save(); }
};

window.changeDeptType = function(id, type) {
  const d = data.departments.find(x => x.id === id);
  if (d) { d.type = type; save(); }
};

window.toggleDept = function(id, on) {
  const d = data.departments.find(x => x.id === id);
  if (d) { d.enabled = on; save(); }
};

window.deleteDept = function(id) {
  if (!confirm('確定刪除此部門？')) return;
  data.departments = data.departments.filter(x => x.id !== id);
  delete data.headcounts[id];
  delete data.deptConfigs[id];
  save();
  window.showDeptModal();
  render();
};

window.addDept = function() {
  const type = document.getElementById('newDeptType').value;
  const id = genDeptId();
  data.departments.push({ id, name: '新部門', type, enabled: true });
  data.headcounts[id] = 0;
  save();
  window.showDeptModal();
  render();
};

// ── Department Sort Modal (drag to reorder) ──
window.showDeptSortModal = function() {
  const bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;display:flex;align-items:center;justify-content:center;';
  bg.onclick = e => { if (e.target === bg) bg.remove(); };
  const depts = data.departments;
  let items = depts.map((d, i) =>
    `<div class="sort-item" data-id="${d.id}" draggable="true" style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:6px;cursor:grab;display:flex;align-items:center;gap:10px;font-size:14px;">
      <span style="color:#94a3b8;">⠿</span>
      <strong>${d.name}</strong>
      <span style="font-size:11px;color:#64748b;">${d.type}</span>
    </div>`
  ).join('');
  bg.innerHTML = `<div style="background:#fff;border-radius:12px;padding:28px;min-width:420px;box-shadow:0 20px 60px rgba(0,0,0,.2);" onclick="event.stopPropagation()">
    <h3 style="margin-bottom:12px;font-size:16px;font-weight:700;">拖曳調整部門順序</h3>
    <div id="sortContainer">${items}</div>
    <div style="margin-top:16px;text-align:right;"><button class="btn-primary" onclick="this.closest('div[style]').parentElement.remove();save();render();">完成</button></div>
  </div>`;
  document.body.appendChild(bg);
  initSortDrag();
};

function initSortDrag() {
  let dragEl = null;
  document.querySelectorAll('.sort-item').forEach(el => {
    el.addEventListener('dragstart', e => {
      dragEl = el;
      e.dataTransfer.effectAllowed = 'move';
      el.style.opacity = '.4';
    });
    el.addEventListener('dragend', e => {
      el.style.opacity = '1';
      dragEl = null;
    });
    el.addEventListener('dragover', e => {
      e.preventDefault();
      if (el !== dragEl) {
        const rect = el.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const parent = el.parentElement;
        if (e.clientY < mid) parent.insertBefore(dragEl, el);
        else parent.insertBefore(dragEl, el.nextSibling);
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

// ── Step 3: Structure ──
function step3HTML() {
  const depts = getDepts();
  let cards = depts.map(d => {
    const hc = data.headcounts[d.id] || 0;
    if (hc === 0) return '';
    const db = getDeptBudget(d);
    const pp = getPerPerson(d) * 10000;
    const cfg = getOrCreateConfig(d, pp);
    const ac = cfg.annualTotal;
    const fr = cfg.fixedRatio;
    const br = cfg.behaviorRatio;
    const pr = cfg.performanceRatio;
    const fc = Math.round(ac * fr / 100);
    const bc = Math.round(ac * br / 100);
    const pc = Math.round(ac * pr / 100);
    const mb = Math.round(fc / 12);
    const subj = cfg.subjects;
    const tClass = d.type === '上山型' ? 'up' : d.type === '平路型' ? 'flat' : 'down';
    return `<div class="str-card" data-dept-id="${d.id}">
      <div class="str-head" draggable="true" data-drag-id="${d.id}" style="cursor:grab;">
        <span style="color:#94a3b8;font-size:14px;user-select:none;">⠿</span>
        <span class="s-name">${d.name}</span>
        <span style="font-size:11px;padding:3px 8px;border-radius:4px;background:${tClass==='up'?'#e3f2fd':tClass==='flat'?'#f3e5f5':'#e0f2fe'};color:#1e293b;">${d.type}</span>
        <span class="s-hc">${hc}人</span>
        <span class="s-budget">部門 NT$ ${db.toLocaleString()} 萬／每人 NT$ ${(ac/10000).toLocaleString()} 萬</span>
      </div>
      <div class="str-body">
        <div class="str-ctl">
          <div class="str-ctl-item"><label>年薪總包</label><input type="number" value="${ac}" min="200000" max="5000000" step="10000" onchange="window.updS3('${d.id}','total',this.value)"></div>
          <div class="str-ctl-item"><label>固定 %</label><input type="number" value="${fr}" min="0" max="100" onchange="window.updS3('${d.id}','fixedPct',this.value)"></div>
          <div class="str-ctl-item"><label>行為(考核) %</label><input type="number" value="${br}" min="0" max="100" onchange="window.updS3('${d.id}','behavePct',this.value)"></div>
          <div class="str-ctl-item"><label>績效 %</label><input type="number" value="${pr}" min="0" max="100" onchange="window.updS3('${d.id}','perfPct',this.value)"></div>
        </div>
        <div class="str-prev">
          <div class="str-panel fixed">
            <div class="str-plabel">■ 固定 ${fr}%</div>
            <div class="str-pamt">NT$ ${fc.toLocaleString()} <small>年</small></div>
            <div class="str-pitems">月固定 NT$ ${mb.toLocaleString()}<span class="subj">${subj.base.join('、')}</span></div>
          </div>
          <div class="str-panel float">
            <div class="str-plabel">■ 浮動 ${br+pr}%</div>
            <div class="str-pamt">NT$ ${(bc+pc).toLocaleString()} <small>年</small></div>
            <div class="str-pitems">行為 ${br}% NT$ ${bc.toLocaleString()}<span class="subj">${subj.behavior.join('、')}</span>
              績效 ${pr}% NT$ ${pc.toLocaleString()}<span class="subj">${subj.performance.join('、')}</span></div>
          </div>
        </div>
        <div class="str-extra">
          <div class="str-extra-item bonus">分紅：${subj.bonus.join('、')}</div>
          <div class="str-extra-item welfare">福利：${subj.welfare.join('、')}</div>
          <div class="str-extra-item risk">風險：${subj.risks.join('、')}</div>
        </div>
        <div style="margin-top:8px;text-align:right;">
          <button class="btn" onclick="window.showSubjectsEditor('${d.id}')">✏ 編輯科目</button>
        </div>
      </div>
    </div>`;
  }).join('');
  return `<div class="scard">
    <div class="scard-title">❸ 薪酬結構設計</div>
    <div class="scard-desc">調整各部門固定／行為考核／績效比例，金額即時連動。拖曳卡片可調整部門順序。點「編輯科目」可自訂考核細項。</div>
    <div id="strDeptList">${cards || '<div class="empty">尚無部門可配置</div>'}</div>
  </div>${stepNav('下一步：總覽報表 ›', true)}`;
}

function getPerPerson(d) {
  const hc = data.headcounts[d.id] || 0;
  const db = getDeptBudget(d);
  return hc > 0 ? Math.round(db / hc) : 0;
}

window.updS3 = function(deptId, field, val) {
  const cfg = data.deptConfigs[deptId];
  if (!cfg) return;
  const v = parseInt(val) || 0;
  if (field === 'total') cfg.annualTotal = v || 600000;
  else if (field === 'fixedPct') {
    cfg.fixedRatio = Math.min(100, Math.max(0, v));
    const remain = 100 - cfg.fixedRatio;
    const tf = cfg.behaviorRatio + cfg.performanceRatio;
    if (tf > 0) { cfg.behaviorRatio = Math.round(remain * cfg.behaviorRatio / tf); cfg.performanceRatio = remain - cfg.behaviorRatio; }
    else { cfg.behaviorRatio = Math.round(remain * 0.5); cfg.performanceRatio = remain - cfg.behaviorRatio; }
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
  save();
  renderStepContent();
  renderSidebar();
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
      save();
      renderStepContent();
    }
  }
  document.querySelectorAll('.str-card').forEach(el => el.style.borderTop = '');
});

// ── Subjects Editor ──
window.showSubjectsEditor = function(deptId) {
  const cfg = data.deptConfigs[deptId];
  if (!cfg) return;
  const d = data.departments.find(x => x.id === deptId);
  const subj = cfg.subjects;
  const catLabels = { base: '固定科目', behavior: '行為考核', performance: '績效考核', bonus: '分紅', welfare: '福利', risks: '風險條件' };
  let html = Object.keys(catLabels).map(cat => {
    const items = subj[cat] || [];
    return `<div style="margin-bottom:12px;">
      <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px;">${catLabels[cat]}</label>
      <div id="subj-${cat}-${deptId}">${items.map((s, i) =>
        `<span style="display:inline-flex;align-items:center;gap:4px;margin:2px;padding:3px 8px;background:#f1f5f9;border-radius:4px;font-size:13px;">
          <input value="${s}" style="width:80px;border:none;background:transparent;font-size:13px;padding:2px;" onchange="window.updSubjItem('${deptId}','${cat}',${i},this.value)">
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
    ${html}
    <div style="margin-top:16px;text-align:right;"><button class="btn-primary" onclick="this.closest('div[style]').parentElement.remove();save();render();">完成</button></div>
  </div>`;
  document.body.appendChild(bg);
};

window.updSubjItem = function(deptId, cat, idx, val) {
  const cfg = data.deptConfigs[deptId];
  if (cfg && cfg.subjects[cat] && cfg.subjects[cat][idx] !== undefined) cfg.subjects[cat][idx] = val;
  save();
};
window.addSubjItem = function(deptId, cat) {
  const cfg = data.deptConfigs[deptId];
  if (cfg) { if (!cfg.subjects[cat]) cfg.subjects[cat] = []; cfg.subjects[cat].push('新項目'); save(); window.showSubjectsEditor(deptId); }
};
window.delSubjItem = function(deptId, cat, idx) {
  const cfg = data.deptConfigs[deptId];
  if (cfg && cfg.subjects[cat]) { cfg.subjects[cat].splice(idx, 1); save(); window.showSubjectsEditor(deptId); }
};

// ── Step 4: Report + Salary Grades + Multi-month Comparison ──
function step4HTML() {
  const depts = getDepts();
  const active = depts.filter(d => data.deptConfigs[d.id] && (data.headcounts[d.id] || 0) > 0);

  let totalF = 0, totalB = 0, totalP = 0, grand = 0;
  let rows = active.map(d => {
    const cfg = data.deptConfigs[d.id];
    const hc = data.headcounts[d.id] || 0;
    const deptTotal = (cfg.fixedAnnual + cfg.behaviorAnnual + cfg.perfAnnual) * hc;
    const deptF = cfg.fixedAnnual * hc;
    const deptB = cfg.behaviorAnnual * hc;
    const deptP = cfg.perfAnnual * hc;
    totalF += deptF; totalB += deptB; totalP += deptP; grand += deptTotal;
    return `<tr><td><strong>${d.name}</strong></td><td>${hc}</td><td class="r">NT$ ${cfg.monthlyBase.toLocaleString()}</td>
      <td class="r">NT$ ${cfg.fixedAnnual.toLocaleString()}</td><td class="r">NT$ ${cfg.behaviorAnnual.toLocaleString()}</td>
      <td class="r">NT$ ${cfg.perfAnnual.toLocaleString()}</td><td class="r">NT$ ${cfg.annualTotal.toLocaleString()}</td>
      <td class="r">NT$ ${deptTotal.toLocaleString()}</td></tr>`;
  }).join('');

  const budgetAt = getAnnualTotal() * 10000;
  const usedPct = budgetAt > 0 ? Math.round(grand / budgetAt * 100) : 0;
  const bench = INDUSTRY_BENCHMARKS[data.industry];
  const health = calcHealth(data.laborRatio, bench);

  // Salary grades — 職等×職級 matrix
  const jf = data.activeJobFamily || '管理系';
  const matrix = (data.gradeMatrix && data.gradeMatrix[jf]) || DEFAULT_GRADE_MATRIX['管理系'];
  const famRow = JOB_FAMILIES.map(f =>
    `<button class="chip ${f === jf ? 'active' : ''}" style="font-size:12px;padding:4px 12px;" onclick="window.switchJobFamily('${f}')">${f}</button>`
  ).join('');
  const gradeRows = matrix.map(g => {
    const lvlRows = g.levels.map((l, li) => `
      <tr>
        <td style="padding:4px 8px;font-size:12px;color:#64748b;">${li === 0 ? `<strong>${g.title}</strong>` : ''}</td>
        <td style="padding:4px 8px;font-size:12px;text-align:center;">${li === 0 ? `<span style="background:#e8eaf6;padding:2px 8px;border-radius:4px;font-weight:600;">${g.grade}等</span>` : ''}</td>
        <td style="padding:4px 8px;font-size:12px;text-align:center;">${l.level}級</td>
        <td style="padding:4px 8px;"><input type="number" value="${l.min}" style="width:80px;padding:3px 6px;border:1px solid #e2e8f0;border-radius:4px;font-size:12px;" onchange="window.updGradeMatrix('${jf}',${g.grade},${li},'min',this.value)"></td>
        <td style="padding:4px 8px;"><input type="number" value="${l.max}" style="width:80px;padding:3px 6px;border:1px solid #e2e8f0;border-radius:4px;font-size:12px;" onchange="window.updGradeMatrix('${jf}',${g.grade},${li},'max',this.value)"></td>
      </tr>`);
    return lvlRows.join('');
  }).join('');

  // Multi-month comparison (saved snapshots)
  let snapRows = '';
  const snapshots = getSnapshots();
  if (snapshots.length > 0) {
    const snapshots2 = snapshots.slice(-6);
    snapRows = `<div class="scard" style="margin-top:16px;">
      <div class="scard-title">📅 月份比較</div>
      <table class="r-table"><thead><tr><th>月份</th><th>總預算</th><th>總成本</th><th>佔用率</th><th>健康</th></tr></thead>
      <tbody>${snapshots2.map(s => {
        const h = calcHealth(s.laborRatio, bench);
        return `<tr><td>${s.month}</td><td class="r">NT$ ${(s.annualTotal/10000).toLocaleString()} 萬</td><td class="r">NT$ ${(s.used/10000).toLocaleString()} 萬</td>
          <td class="r">${s.pct}%</td><td style="color:${h.color};">${h.text}</td></tr>`;
      }).join('')}</tbody></table>
    </div>`;
  }

  return `<div class="scard">
    <div class="scard-title" style="display:flex;align-items:center;justify-content:space-between;">
      <span>❹ 總覽報表</span>
      <div>
        <button class="btn" onclick="window.saveSnapshot()">📸 存檔比較</button>
        <button class="btn" onclick="window.exportExcel()">📥 Excel 匯出</button>
      </div>
    </div>
    <table class="r-table"><thead><tr><th>部門</th><th>人數</th><th class="r">月固定</th><th class="r">年固定</th><th class="r">行為(考核)</th><th class="r">績效</th><th class="r">每人年薪</th><th class="r">部門總成本</th></tr></thead>
      <tbody>${rows}
      <tr class="t-total"><td><strong>合計</strong></td><td><strong>${getTotalHC()}</strong></td><td class="r"><strong>NT$ ${Math.round(totalF/12).toLocaleString()}</strong></td>
        <td class="r"><strong>NT$ ${totalF.toLocaleString()}</strong></td><td class="r"><strong>NT$ ${totalB.toLocaleString()}</strong></td><td class="r"><strong>NT$ ${totalP.toLocaleString()}</strong></td>
        <td class="r"><strong>NT$ ${getTotalHC() > 0 ? Math.round(grand/getTotalHC()).toLocaleString() : 0}</strong></td><td class="r"><strong>NT$ ${grand.toLocaleString()}</strong></td></tr>
      </tbody></table>
    <div class="r-health" style="border-left-color:${health.color};color:${health.color};background:${health.bg}">${health.text} — ${data.industry} 建議 ${bench ? bench.laborRate : '—'}，目前設定 ${data.laborRatio}%，佔用 ${usedPct}%${bench && bench.note ? `<br><span style="font-weight:400;font-size:11px;">${bench.note}</span>` : ''}</div>
  </div>

  <!-- Grade Matrix -->
  <div class="scard">
    <div class="scard-title" style="display:flex;align-items:center;justify-content:space-between;">
      <span>📊 職等職級對照表</span>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:11px;color:#64748b;">職系：</span>
        ${famRow}
      </div>
    </div>
    <div class="scard-desc">職等（Grade）= 責任權限 • 職級（Step）= 熟練度 • 各職系薪資結構不同，可切換檢視。月固定薪應對照所屬職等職級範圍。</div>
    <table class="r-table" style="font-size:12px;"><thead><tr><th style="width:25%;">職稱</th><th style="width:60px;">職等</th><th style="width:50px;">職級</th><th>下限</th><th>上限</th></tr></thead>
      <tbody>${gradeRows}</tbody>
    </table>
  </div>

  ${snapRows}`;
}

// ── Snapshots (multi-month comparison) ──
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
    const cfg = data.deptConfigs[d.id];
    const hc = data.headcounts[d.id] || 0;
    if (cfg && hc > 0) grand += (cfg.fixedAnnual + cfg.behaviorAnnual + cfg.perfAnnual) * hc;
  });
  const at = getAnnualTotal() * 10000;
  const pct = at > 0 ? Math.round(grand / at * 100) : 0;
  snapshots.push({ month: label, annualTotal: getAnnualTotal() * 10000, used: grand, pct, laborRatio: data.laborRatio });
  localStorage.setItem('salary_snapshots', JSON.stringify(snapshots));
  renderStepContent();
};

// ── Grade Matrix Management ──
window.switchJobFamily = function(f) {
  if (!data.gradeMatrix) data.gradeMatrix = JSON.parse(JSON.stringify(DEFAULT_GRADE_MATRIX));
  data.activeJobFamily = f;
  save();
  renderStepContent();
};

window.updGradeMatrix = function(family, grade, lvlIdx, field, val) {
  if (!data.gradeMatrix) data.gradeMatrix = JSON.parse(JSON.stringify(DEFAULT_GRADE_MATRIX));
  const entry = data.gradeMatrix[family]?.find(g => g.grade === grade);
  if (entry && entry.levels[lvlIdx]) {
    entry.levels[lvlIdx][field] = parseInt(val) || 0;
    save();
  }
};

// ── Old grade functions (keep for backward compat) ──
window.updGrade = function(i, field, val) {
  if (!data.grades) data.grades = JSON.parse(JSON.stringify(DEFAULT_GRADES));
  if (field === 'level') data.grades[i].level = val;
  else if (field === 'min') data.grades[i].min = parseInt(val) || 0;
  else if (field === 'max') data.grades[i].max = parseInt(val) || 0;
  save();
};
window.addGrade = function() {
  if (!data.grades) data.grades = JSON.parse(JSON.stringify(DEFAULT_GRADES));
  data.grades.push({ level: '新職等', min: 30000, max: 40000 });
  save();
  renderStepContent();
};
window.delGrade = function(i) {
  if (!data.grades) return;
  data.grades.splice(i, 1);
  save();
  renderStepContent();
};

// ── Sidebar ──
function renderSidebar() {
  const el = document.getElementById('sidebarOverview');
  if (!data || !data.industry) { el.innerHTML = '<div class="sbo"><div class="sbo-title">📊 預算概覽</div><div class="empty" style="padding:20px 0;">請先選擇產業</div></div>'; return; }

  const depts = getDepts();
  const at = getAnnualTotal();
  const totalHC = getTotalHC();

  let allocatedTotal = 0;
  let deptLines = '';
  depts.forEach(d => {
    const hc = data.headcounts[d.id] || 0;
    const cfg = data.deptConfigs[d.id];
    const db = cfg && hc > 0 ? (cfg.fixedAnnual + cfg.behaviorAnnual + cfg.perfAnnual) * hc : 0;
    if (hc > 0) allocatedTotal += db;
    deptLines += `<div class="sbo-row"><span class="sbo-lbl">${d.name}</span><span class="sbo-val">${hc > 0 ? `NT$${Math.round(db/10000).toLocaleString()}萬` : '—'}</span></div>`;
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
    <div class="sbo-health" style="background:${health.bg};color:${health.color};">${health.text} — ${data.industry} 建議 ${bench ? bench.laborRate : '—'}，目前 ${data.laborRatio}%${bench && bench.note ? `<br><span style="font-weight:400;font-size:11px;">${bench.note}</span>` : ''}</div>
  </div>`;
}

// ── Plan Management (Save/Load local + Supabase) ──
function renderPlanList() {
  const el = document.getElementById('planSelector');
  if (!el) return;
  const plans = getPlanList();
  el.innerHTML = `<select onchange="window.loadPlan(this.value)" style="padding:6px 10px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:13px;min-width:120px;">
    <option value="">— 切換方案 —</option>
    ${plans.map((p, i) => `<option value="${i}">${p.name}</option>`).join('')}
  </select>
  <button class="btn" onclick="window.saveAsPlan()">💾 另存方案</button>
  <button class="btn" onclick="window.deletePlan()" style="color:#ef4444;">🗑 刪除</button>
  ${curUser ? '<button class="btn" onclick="window.syncToSupabase()">☁ 同步</button>' : ''}
  <span id="planStatus" style="font-size:12px;color:#94a3b8;margin-left:8px;"></span>`;
}

function getPlanListKey() { return 'salary_plan_list_v2'; }

function getPlanList() {
  try { return JSON.parse(localStorage.getItem(getPlanListKey()) || '[]'); } catch { return []; }
}

function setPlanList(list) {
  localStorage.setItem(getPlanListKey(), JSON.stringify(list));
  renderPlanList();
}

window.saveAsPlan = function() {
  const name = prompt('方案名稱：', data.planName || '新方案');
  if (!name) return;
  const plans = getPlanList();
  const idx = plans.findIndex(p => p.name === name);
  const entry = { name, data: JSON.parse(JSON.stringify(data)), updatedAt: new Date().toISOString() };
  if (idx >= 0) plans[idx] = entry;
  else plans.push(entry);
  data.planName = name;
  setPlanList(plans);
  save();
  document.getElementById('planStatus').textContent = `✅ 已儲存「${name}」`;
};

window.loadPlan = function(val) {
  if (val === '') return;
  const plans = getPlanList();
  const idx = parseInt(val);
  if (!plans[idx]) return;
  data = JSON.parse(JSON.stringify(plans[idx].data));
  data.planName = plans[idx].name;
  currentStep = data.step || 1;
  save();
  renderIndustries();
  render();
  renderPlanList();
  document.getElementById('planStatus').textContent = `📂 已載入「${plans[idx].name}」`;
};

window.deletePlan = function() {
  const plans = getPlanList();
  if (plans.length === 0) return;
  const names = plans.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
  const idx = parseInt(prompt(`選擇要刪除的方案編號：\n${names}`)) - 1;
  if (isNaN(idx) || !plans[idx]) return;
  if (!confirm(`確定刪除「${plans[idx].name}」？`)) return;
  plans.splice(idx, 1);
  setPlanList(plans);
  document.getElementById('planStatus').textContent = '🗑 已刪除';
};

// ── Supabase Sync ──
window.syncToSupabase = async function() {
  const status = document.getElementById('planStatus');
  status.textContent = '⏳ 同步中...';
  try {
    const plans = getPlanList();
    for (const p of plans) {
      await supabaseSave(null, p.name, '', p.data);
    }
    status.textContent = `☁ 已同步 ${plans.length} 筆至雲端`;
  } catch (e) {
    status.textContent = '⚠ 同步失敗：' + e.message;
  }
};

// ── Excel Export ──
window.exportExcel = function() {
  const depts = getDepts();
  const active = depts.filter(d => data.deptConfigs[d.id] && (data.headcounts[d.id] || 0) > 0);
  let html = `<table>
    <tr><th>部門</th><th>人數</th><th>月固定</th><th>年固定</th><th>行為(考核)</th><th>績效</th><th>每人年薪</th><th>部門總成本</th></tr>`;
  active.forEach(d => {
    const cfg = data.deptConfigs[d.id];
    const hc = data.headcounts[d.id] || 0;
    const deptTotal = (cfg.fixedAnnual + cfg.behaviorAnnual + cfg.perfAnnual) * hc;
    html += `<tr><td>${d.name}</td><td>${hc}</td><td>${cfg.monthlyBase}</td><td>${cfg.fixedAnnual}</td><td>${cfg.behaviorAnnual}</td><td>${cfg.perfAnnual}</td><td>${cfg.annualTotal}</td><td>${deptTotal}</td></tr>`;
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
function setupPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// ── Init plan list on load ──
if (document.getElementById('planSelector')) renderPlanList();
setupPWA();

// Export for window
window.exportCSV = function() {
  if (!data) return;
  const depts = getDepts();
  const active = depts.filter(d => data.deptConfigs[d.id] && (data.headcounts[d.id] || 0) > 0);
  let csv = '\uFEFF部門,人數,月固定薪,年固定,行為獎金,績效獎金,每人年薪,部門總成本\n';
  active.forEach(d => {
    const cfg = data.deptConfigs[d.id];
    const hc = data.headcounts[d.id] || 0;
    const deptTotal = (cfg.fixedAnnual + cfg.behaviorAnnual + cfg.perfAnnual) * hc;
    csv += `${d.name},${hc},${cfg.monthlyBase},${cfg.fixedAnnual},${cfg.behaviorAnnual},${cfg.perfAnnual},${cfg.annualTotal},${deptTotal}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `薪酬結構_${data.industry}.csv`;
  a.click();
};
window.exportPDF = function() { window.print(); };
