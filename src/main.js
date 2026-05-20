import { signInWithGoogle, signOut, onAuthChange, getCurrentUser } from './auth.js';
import { INDUSTRIES, DEPT_TYPE, DEPT_RATIOS, DEPT_SUBJECTS, INDUSTRY_BENCHMARKS, ONE_LINERS, createDeptConfig, ALL_DEPTS } from './data.js';

let curUser = null;
let currentStep = 1;
let data = null;

const STORAGE_KEY = 'salary_v1';

function defaultData(ind) {
  const depts = INDUSTRIES[ind] || [];
  const hc = {};
  depts.forEach(d => { hc[d] = 3; });
  const bench = INDUSTRY_BENCHMARKS[ind];
  const range = bench ? parseRange(bench.laborRate) : { min: 20, max: 40 };
  const mid = Math.round((range.min + range.max) / 2);
  return {
    industry: ind,
    monthlyRevenue: 500,
    laborRatio: mid,
    headcounts: hc,
    deptConfigs: {},
    step: 1
  };
}

function parseRange(str) {
  if (!str) return { min: 20, max: 40 };
  const m = str.match(/([\d.]+)\s*-\s*([\d.]+)/);
  return m ? { min: parseFloat(m[1]), max: parseFloat(m[2]) } : { min: 20, max: 40 };
}

// Auth
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
      if (data && data.industry && INDUSTRIES[data.industry]) {
        renderIndustries();
        currentStep = data.step || 1;
        render();
        return;
      }
    } catch(e) {}
  }
  renderIndustries();
}

// Industry chips
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
};

// ── Render ──
function render() {
  if (!data) { document.getElementById('stepContent').innerHTML = '<div class="empty">請先選擇產業類別</div>'; renderSidebar(); return; }
  renderSteps();
  renderStepContent();
  renderSidebar();
}

function getAnnualTotal() {
  return data.monthlyRevenue * 12 * data.laborRatio / 100;
}

function getTotalHC() {
  const depts = INDUSTRIES[data.industry];
  return depts.reduce((s, d) => s + (data.headcounts[d] || 0), 0);
}

function getDeptBudget(d) {
  const totalHC = getTotalHC();
  const hc = data.headcounts[d] || 0;
  return totalHC > 0 ? Math.round(getAnnualTotal() * hc / totalHC) : 0;
}

function getPerPerson(d) {
  const hc = data.headcounts[d] || 0;
  const db = getDeptBudget(d);
  return hc > 0 ? Math.round(db / hc) : 0;
}

function save() {
  if (data) { data.step = currentStep; localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
}

// ── Step Indicator ──
function renderSteps() {
  const labels = ['設定總預算', '配置部門人數', '薪酬結構設計', '總覽報表'];
  const states = ['pending', 'pending', 'pending', 'pending'];
  for (let i = 0; i < currentStep; i++) states[i] = 'done';
  states[currentStep - 1] = 'active';
  document.getElementById('stepIndicator').innerHTML = states.map((s, i) => {
    const n = i + 1;
    const icons = ['❶', '❷', '❸', '❹'];
    return `${i > 0 ? '<span class="step-arrow">›</span>' : ''}<div class="step ${s}" onclick="window.goStep(${n})" style="cursor:pointer;"><div class="step-num">${icons[i]}</div><div class="step-label">${labels[i]}</div></div>`;
  }).join('');
}

window.goStep = function(n) {
  if (n < 1 || n > 4) return;
  if (n > currentStep + 1) return;
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
    <div class="b1-suggest">${bench ? `💡 ${data.industry} 業界參考：人事成本 ${bench.laborRate}，毛利率 ${bench.grossMargin}` : ''}</div>
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

// ── Step 2: Allocation ──
function step2HTML() {
  const depts = INDUSTRIES[data.industry];
  const at = getAnnualTotal();
  const totalHC = getTotalHC();
  let rows = depts.map(d => {
    const hc = data.headcounts[d] || 0;
    const db = getDeptBudget(d);
    const pct = at > 0 ? Math.round(db / at * 100) : 0;
    return `<tr>
      <td><strong>${d}</strong> <span class="d-type ${DEPT_TYPE[d]==='上山型'?'up':DEPT_TYPE[d]==='平路型'?'flat':'down'}" style="font-size:10px;padding:2px 6px;border-radius:4px;">${DEPT_TYPE[d]}</span></td>
      <td><input type="number" value="${hc}" min="0" max="500" onchange="window.updS2HC('${d}',this.value)"></td>
      <td class="r">${hc > 0 ? `NT$ ${db.toLocaleString()} 萬` : '—'}</td>
      <td class="r">${hc > 0 ? `${pct}%` : '—'}</td>
    </tr>`;
  }).join('');
  return `<div class="scard">
    <div class="scard-title">❷ 配置部門人數</div>
    <div class="scard-desc">填入各部門人數，預算按人數比例自動分配（總 ${totalHC} 人）。人數為 0 則不分配預算。</div>
    <table class="b2-table"><thead><tr><th>部門</th><th>人數</th><th class="r">部門年預算</th><th class="r">佔比</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="b2-total"><td><strong>合計</strong></td><td><strong>${totalHC}</strong></td><td class="r"><strong>NT$ ${at.toLocaleString()} 萬</strong></td><td class="r"><strong>100%</strong></td></tr></tfoot>
    </table>
  </div>${stepNav('下一步：薪酬結構 ›', totalHC > 0)}`;
}

window.updS2HC = function(dept, val) {
  const n = parseInt(val);
  data.headcounts[dept] = !isNaN(n) && n >= 0 ? n : 0;
  save();
  renderStepContent();
  renderSidebar();
};

// ── Step 3: Structure ──
function step3HTML() {
  const depts = INDUSTRIES[data.industry];
  let cards = depts.map(d => {
    const hc = data.headcounts[d] || 0;
    if (hc === 0) return '';
    const db = getDeptBudget(d);
    const pp = getPerPerson(d) * 10000;
    const type = DEPT_TYPE[d];
    const tClass = type === '上山型' ? 'up' : type === '平路型' ? 'flat' : 'down';
    const r = DEPT_RATIOS[d];
    const cfg = data.deptConfigs[d];
    const ac = cfg ? cfg.annualTotal : pp;
    const fr = cfg ? cfg.fixedRatio : r.fixed;
    const br = cfg ? cfg.behaviorRatio : r.behavior;
    const pr = cfg ? cfg.performanceRatio : r.performance;
    const fc = Math.round(ac * fr / 100);
    const bc = Math.round(ac * br / 100);
    const pc = Math.round(ac * pr / 100);
    const mb = Math.round(fc / 12);
    const subj = DEPT_SUBJECTS[d];
    if (!data.deptConfigs[d]) {
      data.deptConfigs[d] = createDeptConfig(d, pp);
      if (!data.deptConfigs[d]) data.deptConfigs[d] = { annualTotal: pp, fixedRatio: r.fixed, behaviorRatio: r.behavior, performanceRatio: r.performance, fixedAnnual: fc, behaviorAnnual: bc, perfAnnual: pc, monthlyBase: mb };
    }
    return `<div class="str-card">
      <div class="str-head">
        <span class="s-name">${d}</span>
        <span class="d-type ${tClass}" style="font-size:11px;padding:3px 8px;border-radius:4px;">${type}</span>
        <span class="s-hc">${hc}人</span>
        <span class="s-budget">部門 NT$ ${db.toLocaleString()} 萬／每人 NT$ ${(ac/10000).toLocaleString()} 萬</span>
      </div>
      <div class="str-body">
        <div class="str-ctl">
          <div class="str-ctl-item"><label>年薪總包</label><input type="number" value="${ac}" min="200000" max="5000000" step="10000" onchange="window.updS3('${d}','total',this.value)"></div>
          <div class="str-ctl-item"><label>固定 %</label><input type="number" value="${fr}" min="0" max="100" onchange="window.updS3('${d}','fixedPct',this.value)"></div>
          <div class="str-ctl-item"><label>行為(考核) %</label><input type="number" value="${br}" min="0" max="100" onchange="window.updS3('${d}','behavePct',this.value)"></div>
          <div class="str-ctl-item"><label>績效 %</label><input type="number" value="${pr}" min="0" max="100" onchange="window.updS3('${d}','perfPct',this.value)"></div>
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
      </div>
    </div>`;
  }).join('');
  return `<div class="scard">
    <div class="scard-title">❸ 薪酬結構設計</div>
    <div class="scard-desc">調整各部門固定／行為考核／績效比例，金額即時連動。每人年薪 = 部門預算 ÷ 人數。</div>
    ${cards || '<div class="empty">尚無部門可配置</div>'}
  </div>${stepNav('下一步：總覽報表 ›', true)}`;
}

window.updS3 = function(d, field, val) {
  const cfg = data.deptConfigs[d];
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

// ── Step 4: Report ──
function step4HTML() {
  const depts = INDUSTRIES[data.industry];
  const active = depts.filter(d => data.deptConfigs[d] && (data.headcounts[d] || 0) > 0);
  if (active.length === 0) return `<div class="scard"><div class="scard-title">❹ 總覽報表</div><div class="empty">尚無資料</div></div>`;

  let totalF = 0, totalB = 0, totalP = 0, totalDept = 0;
  let rows = active.map(d => {
    const cfg = data.deptConfigs[d];
    const hc = data.headcounts[d] || 0;
    const type = DEPT_TYPE[d];
    const tc = type === '上山型' ? 'up' : type === '平路型' ? 'flat' : 'down';
    const deptTotal = (cfg.fixedAnnual + cfg.behaviorAnnual + cfg.perfAnnual) * hc;
    const deptF = cfg.fixedAnnual * hc;
    const deptB = cfg.behaviorAnnual * hc;
    const deptP = cfg.perfAnnual * hc;
    totalF += deptF; totalB += deptB; totalP += deptP; totalDept += deptTotal;
    return `<tr class="t-${tc}"><td><strong>${d}</strong></td><td>${hc}</td><td class="r">NT$ ${cfg.monthlyBase.toLocaleString()}</td><td class="r">NT$ ${cfg.fixedAnnual.toLocaleString()}</td><td class="r">NT$ ${cfg.behaviorAnnual.toLocaleString()}</td><td class="r">NT$ ${cfg.perfAnnual.toLocaleString()}</td><td class="r">NT$ ${cfg.annualTotal.toLocaleString()}</td><td class="r">NT$ ${deptTotal.toLocaleString()}</td></tr>`;
  }).join('');

  const budgetAt = getAnnualTotal() * 10000;
  const usedPct = budgetAt > 0 ? Math.round(totalDept / budgetAt * 100) : 0;
  const bench = INDUSTRY_BENCHMARKS[data.industry];
  const range = bench ? parseRange(bench.laborRate) : null;
  let health = '', healthColor = '';
  if (range) {
    const r = data.laborRatio;
    if (r < range.min * 0.8) { health = '⚠️ 偏低 — 可能留不住人'; healthColor = '#f39c12'; }
    else if (r <= range.max) { health = '✅ 很健康 — 人事成本在建議範圍內'; healthColor = '#2e7d32'; }
    else if (r <= range.max * 1.3) { health = '⚡ 有問題 — 接近紅線'; healthColor = '#e65100'; }
    else { health = '🔴 有危險 — 人事成本過高'; healthColor = '#c62828'; }
  }

  const grand = totalF + totalB + totalP;
  return `<div class="scard">
    <div class="scard-title">❹ 總覽報表</div>
    <table class="r-table"><thead><tr><th>部門</th><th>人數</th><th class="r">月固定</th><th class="r">年固定</th><th class="r">行為(考核)</th><th class="r">績效</th><th class="r">每人年薪</th><th class="r">部門總成本</th></tr></thead>
      <tbody>${rows}
      <tr class="t-total"><td><strong>合計</strong></td><td><strong>${getTotalHC()}</strong></td><td class="r"><strong>NT$ ${Math.round(totalF/12).toLocaleString()}</strong></td>
        <td class="r"><strong>NT$ ${totalF.toLocaleString()}</strong></td><td class="r"><strong>NT$ ${totalB.toLocaleString()}</strong></td><td class="r"><strong>NT$ ${totalP.toLocaleString()}</strong></td>
        <td class="r"><strong>NT$ ${Math.round(grand/getTotalHC()).toLocaleString()}</strong></td><td class="r"><strong>NT$ ${grand.toLocaleString()}</strong></td></tr>
      </tbody></table>
    ${health ? `<div class="r-health" style="border-left-color:${healthColor};color:${healthColor};background:${healthColor}10">${health}</div>` : ''}
  </div>`;
}

// ── Sidebar ──
function renderSidebar() {
  const el = document.getElementById('sidebarOverview');
  if (!data || !data.industry) { el.innerHTML = '<div class="sbo"><div class="sbo-title">📊 預算概覽</div><div class="empty" style="padding:20px 0;">請先選擇產業</div></div>'; return; }

  const depts = INDUSTRIES[data.industry];
  const at = getAnnualTotal();
  const totalHC = getTotalHC();

  let allocatedTotal = 0;
  let deptLines = '';
  depts.forEach(d => {
    const hc = data.headcounts[d] || 0;
    const cfg = data.deptConfigs[d];
    const db = cfg && hc > 0 ? (cfg.fixedAnnual + cfg.behaviorAnnual + cfg.perfAnnual) * hc : 0;
    if (hc > 0) { allocatedTotal += db; }
    deptLines += `<div class="sbo-row"><span class="sbo-lbl">${d}</span><span class="sbo-val">${hc > 0 ? `NT$${Math.round(db/10000).toLocaleString()}萬` : '—'}</span></div>`;
  });

  const budgetAt = at * 10000;
  const pct = budgetAt > 0 ? Math.min(100, Math.round(allocatedTotal / budgetAt * 100)) : 0;
  const barClass = pct <= 80 ? 'good' : pct <= 100 ? 'warn' : 'danger';
  const barLabel = pct <= 80 ? '預算餘裕' : pct <= 100 ? '預算用滿' : '超出預算';

  const bench = INDUSTRY_BENCHMARKS[data.industry];
  const range = bench ? parseRange(bench.laborRate) : null;
  let healthBlock = '';
  if (range && currentStep >= 1) {
    const r = data.laborRatio;
    let hText = '', hColor = '', hBg = '';
    if (r < range.min * 0.8) { hText = '⚠️ 偏低'; hColor = '#f39c12'; hBg = '#fff8e1'; }
    else if (r <= range.max) { hText = '✅ 很健康'; hColor = '#2e7d32'; hBg = '#e8f5e9'; }
    else if (r <= range.max * 1.3) { hText = '⚡ 有問題'; hColor = '#e65100'; hBg = '#fff3e0'; }
    else { hText = '🔴 有危險'; hColor = '#c62828'; hBg = '#ffebee'; }
    healthBlock = `<div class="sbo-health" style="background:${hBg};color:${hColor};">${hText} — ${data.industry} 建議 ${range.min}%-${range.max}%，目前設定 ${r}%</div>`;
  }

  el.innerHTML = `<div class="sbo">
    <div class="sbo-title">📊 預算概覽</div>
    <div class="sbo-row"><span class="sbo-lbl">年總預算</span><span class="sbo-val">NT$ ${at.toLocaleString()} 萬</span></div>
    <div class="sbo-row"><span class="sbo-lbl">總人數</span><span class="sbo-val">${totalHC} 人</span></div>
    <div class="sbo-row"><span class="sbo-lbl">已分配</span><span class="sbo-val">NT$ ${Math.round(allocatedTotal/10000).toLocaleString()} 萬</span></div>
    <div class="sbo-bar"><div class="sbo-bar-fill ${barClass}" style="width:${pct}%"></div></div>
    <div class="sbo-bar-label">${pct}% ${barLabel}</div>
    ${deptLines}
    ${healthBlock}
  </div>`;
}

// ── Export ──
window.exportCSV = function() {
  if (!data) return;
  const depts = INDUSTRIES[data.industry];
  const active = depts.filter(d => data.deptConfigs[d] && (data.headcounts[d] || 0) > 0);
  let csv = '\uFEFF部門,人數,月固定薪,年固定,行為獎金,績效獎金,每人年薪,部門總成本\n';
  active.forEach(d => {
    const cfg = data.deptConfigs[d];
    const hc = data.headcounts[d] || 0;
    const deptTotal = (cfg.fixedAnnual + cfg.behaviorAnnual + cfg.perfAnnual) * hc;
    csv += `${d},${hc},${cfg.monthlyBase},${cfg.fixedAnnual},${cfg.behaviorAnnual},${cfg.perfAnnual},${cfg.annualTotal},${deptTotal}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `薪酬結構_v1_${data.industry}.csv`;
  a.click();
};

window.exportPDF = function() { window.print(); };
