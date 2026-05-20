import { calculate } from './calculate.js';
import { signInWithGoogle, signOut, onAuthChange, getCurrentUser, loadPlans, savePlan as dbSavePlan, deletePlan as dbDeletePlan, getDefaultPlan } from './auth.js';
import { exportCSV as doExportCSV, exportPDF as doExportPDF, exportComparisonCSV } from './export.js';

// ── State ──
let currentUser = null;
let plans = [];
let currentPlanId = null;
let comparisonPlans = [];

// ── Auth ──
onAuthChange((event, user) => {
  if (user) {
    currentUser = user;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('userName').textContent = user.user_metadata?.full_name || user.email;
    document.getElementById('userAvatar').src = user.user_metadata?.avatar_url || '';
    initApp();
    showTutorial(true);
  } else {
    currentUser = null;
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
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
    showTutorial(true);
  }
});

window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;

// ── Initialization ──
async function initApp() {
  await refreshPlanList();
  const def = getDefaultPlan();
  renderForm(def.config);
  document.getElementById('planName').value = def.name;
  currentPlanId = null;
  doCalculate();
}

async function refreshPlanList() {
  try {
    plans = await loadPlans();
  } catch {
    plans = [];
  }
  const list = document.getElementById('planList');
  list.innerHTML = plans.map(p =>
    `<div class="plan-item ${p.id === currentPlanId ? 'active' : ''}" data-id="${p.id}" onclick="window.loadPlan('${p.id}')">
      <div class="plan-name">${p.name}</div>
      <div class="plan-date">${new Date(p.updated_at || p.created_at).toLocaleDateString('zh-TW')}</div>
    </div>`
  ).join('');
}

// ── Live Recalculation ──
function attachLiveCalc(root) {
  root.querySelectorAll('input:not([type="checkbox"]):not([type="hidden"]), select').forEach(el => {
    el.addEventListener('input', () => window.doCalculate());
  });
  root.querySelectorAll('input[type="checkbox"]').forEach(el => {
    el.addEventListener('change', () => window.doCalculate());
  });
}
const _origAddStepRow = window.addStepRowDOM || addStepRowDOM;
function addStepRowLive(th, rt, idx) {
  addStepRowDOM(th, rt, idx);
  const lastRow = document.getElementById('stepBody').lastElementChild;
  if (lastRow) attachLiveCalc(lastRow);
}
window.addStepRow = function() { addStepRowLive(); };

const _origAddCbRow = addCbRowDOM;
function addCbRowLive(amt, rt, total, ful) {
  addCbRowDOM(amt, rt, total, ful);
  const lastRow = document.getElementById('cbBody').lastElementChild;
  if (lastRow) attachLiveCalc(lastRow);
}
window.addCbRow = function() { addCbRowLive(); };

// ── Form Rendering ──
function renderForm(config) {
  const col = document.getElementById('inputCol');
  col.innerHTML = `
    <div class="card">
      <h3>基本設定</h3>
      <div class="form-row2">
        <div class="form-group"><label>職務形狀</label><select id="fJobType">
          <option ${config.jobType === '上山型' ? 'selected' : ''}>上山型（業務/銷售）</option>
          <option ${config.jobType === '平路型' ? 'selected' : ''}>平路型（行政/管理）</option>
          <option ${config.jobType === '下山型' ? 'selected' : ''}>下山型（研發/技術）</option>
        </select></div>
        <div class="form-group"><label>獎金類型</label><select id="fBonusType">
          <option value="commission" ${config.bonusType === 'commission' ? 'selected' : ''}>銷售佣金制</option>
          <option value="mbo" ${config.bonusType === 'mbo' ? 'selected' : ''}>MBO/KPI 目標管理</option>
          <option value="comprehensive" ${config.bonusType === 'comprehensive' ? 'selected' : ''}>年度綜合獎金</option>
        </select></div>
      </div>
      <div class="form-row3">
        <div class="form-group"><label>底薪（年/萬）</label><input type="number" id="fBaseSalary" value="${config.baseSalary}" min="0"></div>
        <div class="form-group"><label>預期獎金（年/萬）</label><input type="number" id="fTargetBonus" value="${config.targetBonus}" min="0"></div>
        <div class="form-group"><label>法定外加成本 %</label><input type="number" id="fOverheadRate" value="${config.overheadRate}" min="0"></div>
      </div>
    </div>

    <div class="card">
      <h3>業績目標</h3>
      <div class="form-row2">
        <div class="form-group"><label>年度目標（萬）</label><input type="number" id="fQuota" value="${config.quota}" min="0"></div>
        <div class="form-group"><label>實際達成（萬）</label><input type="number" id="fActual" value="${config.actual}" min="0"></div>
      </div>
    </div>

    <div class="card">
      <h3>階梯門檻設定 <span style="font-weight:400;font-size:11px;color:#888;">（提撥率遞增）</span></h3>
      <table class="step-table"><thead><tr><th>區間</th><th>門檻(萬)</th><th>提撥率%</th><th></th></tr></thead><tbody id="stepBody"></tbody></table>
      <button class="btn-add" onclick="window.addStepRow()">+ 新增區間</button>
    </div>

    <div class="card">
      <h3>甜蜜點與封頂設定</h3>
      <div class="form-row3">
        <div class="form-group"><label>甜蜜點 (萬)</label><input type="number" id="fSweetSpot" value="${config.sweetSpot}" min="0"></div>
        <div class="form-group"><label>過甜蜜點提撥率 %</label><input type="number" id="fDecelRate" value="${config.decelRate}" min="0" step="0.5"></div>
        <div class="form-group"><label>獎金上限 (萬)</label><input type="number" id="fBonusCap" value="${config.bonusCap}" min="0"></div>
      </div>
    </div>

    <div class="card">
      <h3>進階門檻設定</h3>
      <div class="toggle"><input type="checkbox" id="fHardThreshold" ${config.hardThreshold?.enabled ? 'checked' : ''}><label for="fHardThreshold">啟用硬門檻（低於某％不發）</label></div>
      <div id="hardThresholdOptions" class="${config.hardThreshold?.enabled ? '' : 'hidden'} form-row2">
        <div class="form-group"><label>最低達成率門檻 %</label><input type="number" id="fHardMinRate" value="${config.hardThreshold?.minRate || 50}" min="0" max="100"></div>
      </div>
      <div class="toggle"><input type="checkbox" id="fRetroThreshold" ${config.retroactiveThreshold?.enabled ? 'checked' : ''}><label for="fRetroThreshold">啟用追溯門檻（超過 100% 後補發）</label></div>
      <div class="toggle"><input type="checkbox" id="fOneYuanStart" ${config.oneYuanStart !== false ? 'checked' : ''}><label for="fOneYuanStart">1 元起抽（業績 1 元就開始計算）</label></div>
    </div>

    <div class="card">
      <h3>品質指標調節</h3>
      <div class="form-group"><label>指標類型</label>
        <select id="fQualityMetric" onchange="window.toggleQualityMetric()">
          <option value="csat" ${(config.qualityMetric||'csat') === 'csat' ? 'selected' : ''}>CSAT（客戶滿意度 /5）</option>
          <option value="nps" ${config.qualityMetric === 'nps' ? 'selected' : ''}>NPS（淨推薦值 0-100）</option>
        </select>
      </div>
      <div id="csatFields">
        <div class="form-row2">
          <div class="form-group"><label>CSAT 目標</label><input type="number" id="fCsatTarget" value="${config.csatTarget}" min="0" max="5" step="0.1"></div>
          <div class="form-group"><label>CSAT 實際</label><input type="number" id="fCsatActual" value="${config.csatActual}" min="0" max="5" step="0.1"></div>
        </div>
        <div class="form-group"><label>CSAT 未達標折扣 %</label><input type="number" id="fCsatPenalty" value="${config.csatPenalty}" min="0" step="1"></div>
      </div>
      <div id="npsFields" class="hidden">
        <div class="form-row2">
          <div class="form-group"><label>NPS 目標</label><input type="number" id="fNpsTarget" value="${config.npsTarget || 50}" min="0" max="100"></div>
          <div class="form-group"><label>NPS 實際</label><input type="number" id="fNpsActual" value="${config.npsActual || 60}" min="0" max="100"></div>
        </div>
        <div class="form-group"><label>NPS 未達標折扣 %</label><input type="number" id="fNpsPenalty" value="${config.npsPenalty || 10}" min="0" step="1"></div>
      </div>
      <div class="form-group"><label>KPI 綜合得分（0-1.2）</label><input type="number" id="fKpiScore" value="${config.kpiScore}" min="0" step="0.01"></div>
      <div class="form-group"><label>KPI 權重 %</label><input type="number" id="fKpiWeight" value="${config.kpiWeight}" min="0" max="100"></div>
      <div class="form-group"><label>行為職能係數（0.8-1.2）</label><input type="number" id="fBehaviorMod" value="${config.behaviorMod}" min="0.8" max="1.2" step="0.05"></div>
    </div>

    <div class="card">
      <h3>銷售成本</h3>
      <div class="form-row2">
        <div class="form-group"><label>銷售成本 COGS %</label><input type="number" id="fCogsRate" value="${config.cogsRate}" min="0" step="1"></div>
        <div class="form-group"><label>毛利佣金比例 %</label><input type="number" id="fGmRate" value="${config.gmRate}" min="0" step="1"></div>
      </div>
    </div>

    <div class="card">
      <h3>Clawback 追回設定</h3>
      <table class="cb-table"><thead><tr><th>訂單金額(萬)</th><th>佣金率%</th><th>合約月數</th><th>已履行月</th><th></th></tr></thead><tbody id="cbBody"></tbody></table>
      <button class="btn-add" onclick="window.addCbRow()">+ 新增 Clawback</button>
    </div>

    <button class="btn-primary" style="width:100%;padding:10px;background:#4361ee;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;margin-top:4px;" onclick="window.doCalculate()">計算獎金</button>
  `;

  // Render steps
  const stepBody = document.getElementById('stepBody');
  stepBody.innerHTML = '';
  if (config.steps && config.steps.length > 0) {
    config.steps.forEach((s, i) => addStepRowDOM(s.threshold, s.rate, i));
  } else {
    addStepRowDOM();
  }

  // Render clawbacks
  const cbBody = document.getElementById('cbBody');
  cbBody.innerHTML = '';
  if (config.clawbacks && config.clawbacks.length > 0) {
    config.clawbacks.forEach(cb => addCbRowDOM(cb.amount, cb.rate, cb.totalMonths, cb.fulfilledMonths));
  } else {
    addCbRowDOM();
  }

  // Bind checkbox events
  document.getElementById('fHardThreshold')?.addEventListener('change', function() {
    document.getElementById('hardThresholdOptions').classList.toggle('hidden', !this.checked);
  });

  // Live calc on all form fields
  attachLiveCalc(document.getElementById('inputCol'));
}

// ── Step Row DOM ──
function addStepRowDOM(threshold, rate, idx) {
  const body = document.getElementById('stepBody');
  const row = document.createElement('tr');
  const i = body.children.length;
  row.innerHTML = `<td style="font-size:11px;color:#888;">第${i+1}階</td>
    <td><input type="number" class="step-th" value="${threshold || ''}" min="0" style="width:70px;"></td>
    <td><input type="number" class="step-rt" value="${rate || ''}" min="0" step="0.5" style="width:70px;"></td>
    <td><button class="btn-sm" onclick="this.closest('tr').remove();window.updateStepLabels()">−</button></td>`;
  body.appendChild(row);
}
window.addStepRow = function() { addStepRowDOM(); };
window.updateStepLabels = function() {
  Array.from(document.getElementById('stepBody').children).forEach((r, i) => {
    r.cells[0].textContent = '第' + (i + 1) + '階';
  });
};

// ── Clawback Row DOM ──
function addCbRowDOM(amount, rate, totalMonths, fulfilledMonths) {
  const body = document.getElementById('cbBody');
  const row = document.createElement('tr');
  row.innerHTML = `<td><input type="number" class="cb-amt" value="${amount || ''}" min="0" style="width:60px;"></td>
    <td><input type="number" class="cb-rt" value="${rate || ''}" min="0" style="width:60px;"></td>
    <td><input type="number" class="cb-total" value="${totalMonths || ''}" min="1" style="width:60px;"></td>
    <td><input type="number" class="cb-ful" value="${fulfilledMonths || ''}" min="0" style="width:60px;"></td>
    <td><button class="btn-sm" onclick="this.closest('tr').remove()">−</button></td>`;
  body.appendChild(row);
}
window.addCbRow = function() { addCbRowDOM(); };

// ── Quality metric toggle ──
window.toggleQualityMetric = function() {
  const v = document.getElementById('fQualityMetric').value;
  document.getElementById('csatFields').classList.toggle('hidden', v !== 'csat');
  document.getElementById('npsFields').classList.toggle('hidden', v !== 'nps');
};

// ── Read Form ──
function readForm() {
  const steps = [];
  document.querySelectorAll('#stepBody tr').forEach(row => {
    const th = parseFloat(row.querySelector('.step-th')?.value) || 0;
    const rt = parseFloat(row.querySelector('.step-rt')?.value) || 0;
    if (th > 0 && rt > 0) steps.push({ threshold: th, rate: rt });
  });

  const clawbacks = [];
  document.querySelectorAll('#cbBody tr').forEach(row => {
    const amt = parseFloat(row.querySelector('.cb-amt')?.value) || 0;
    const rt = parseFloat(row.querySelector('.cb-rt')?.value) || 0;
    const total = parseFloat(row.querySelector('.cb-total')?.value) || 0;
    const ful = parseFloat(row.querySelector('.cb-ful')?.value) || 0;
    if (amt > 0) clawbacks.push({ amount: amt, rate: rt, totalMonths: total, fulfilledMonths: ful });
  });

  return {
    baseSalary: parseFloat(document.getElementById('fBaseSalary')?.value) || 0,
    targetBonus: parseFloat(document.getElementById('fTargetBonus')?.value) || 0,
    overheadRate: parseFloat(document.getElementById('fOverheadRate')?.value) || 0,
    quota: parseFloat(document.getElementById('fQuota')?.value) || 0,
    actual: parseFloat(document.getElementById('fActual')?.value) || 0,
    steps,
    sweetSpot: parseFloat(document.getElementById('fSweetSpot')?.value) || 0,
    decelRate: parseFloat(document.getElementById('fDecelRate')?.value) || 0,
    bonusCap: parseFloat(document.getElementById('fBonusCap')?.value) || 0,
    cogsRate: parseFloat(document.getElementById('fCogsRate')?.value) || 0,
    gmRate: parseFloat(document.getElementById('fGmRate')?.value) || 0,
    kpiScore: parseFloat(document.getElementById('fKpiScore')?.value) || 0,
    kpiWeight: parseFloat(document.getElementById('fKpiWeight')?.value) || 0,
    csatTarget: parseFloat(document.getElementById('fCsatTarget')?.value) || 0,
    csatActual: parseFloat(document.getElementById('fCsatActual')?.value) || 0,
    csatPenalty: parseFloat(document.getElementById('fCsatPenalty')?.value) || 0,
    behaviorMod: parseFloat(document.getElementById('fBehaviorMod')?.value) || 1.0,
    clawbacks,
    hardThreshold: {
      enabled: document.getElementById('fHardThreshold')?.checked || false,
      minRate: parseFloat(document.getElementById('fHardMinRate')?.value) || 50
    },
    retroactiveThreshold: { enabled: document.getElementById('fRetroThreshold')?.checked || false },
    oneYuanStart: document.getElementById('fOneYuanStart')?.checked !== false,
    qualityMetric: document.getElementById('fQualityMetric')?.value || 'csat',
    npsTarget: parseFloat(document.getElementById('fNpsTarget')?.value) || 50,
    npsActual: parseFloat(document.getElementById('fNpsActual')?.value) || 60,
    npsPenalty: parseFloat(document.getElementById('fNpsPenalty')?.value) || 10,
    jobType: document.getElementById('fJobType')?.value || '',
    bonusType: document.getElementById('fBonusType')?.value || 'commission'
  };
}

// ── Calculate ──
function fmtW(v) { return Math.round(v).toLocaleString() + ' 萬'; }
function fmt(v) { return 'NT$' + Math.round(v).toLocaleString(); }

window.doCalculate = function() {
  const config = readForm();
  const result = calculate(config);
  renderResults(result, config);
};

function renderResults(r, config) {
  // Summary
  document.getElementById('resultSummary').innerHTML = `
    <div class="result-grid">
      <div class="result-item"><div class="label">達成率</div><div class="value">${(r.achieveRate * 100).toFixed(1)}%</div></div>
      <div class="result-item highlight"><div class="label">最終獎金</div><div class="value">${fmtW(r.finalBonus)}</div></div>
      <div class="result-item gold"><div class="label">甜蜜點獎金</div><div class="value">${fmtW(r.sweetBonus)}</div></div>
      <div class="result-item"><div class="label">原始佣金</div><div class="value">${fmtW(r.rawCommission)}</div></div>
      <div class="result-item danger"><div class="label">Clawback 扣回</div><div class="value">${r.totalClawback > 0 ? '-' + fmtW(r.totalClawback) : 'NT$0'}</div></div>
      <div class="result-item"><div class="label">邊際提撥率</div><div class="value">${r.marginalRate.toFixed(1)}%</div></div>
    </div>
    <div class="result-grid">
      <div class="result-item success"><div class="label">實領年薪</div><div class="value">${fmtW(r.totalPay)}</div></div>
      <div class="result-item"><div class="label">勞動分配率</div><div class="value">${r.laborRate.toFixed(1)}%</div></div>
      <div class="result-item"><div class="label">Compa-Ratio</div><div class="value">${r.compaRatio.toFixed(2)}</div></div>
      <div class="result-item"><div class="label">距甜蜜點</div><div class="value">${(r.sweetGap >= 0 ? '+' : '') + r.sweetGap.toFixed(1)}%</div></div>
    </div>
  `;

  // Tier table
  const tbody = document.getElementById('tierBody');
  tbody.innerHTML = r.tiers.map(t =>
    `<tr class="${t.cls}"><td>${t.name}</td><td class="r">${fmtW(t.amt)}</td><td class="r">${t.rate}</td><td class="r">${fmtW(t.bonus)}</td></tr>`
  ).join('');
  if (r.capHit) {
    tbody.innerHTML += `<tr class="cap-row"><td>封頂扣減</td><td class="r">—</td><td class="r">—</td><td class="r">-${fmtW(r.capDeduction)}</td></tr>`;
  }
  tbody.innerHTML += `<tr class="total-row"><td colspan="3" class="r">佣金合計</td><td class="r">${fmtW(r.cappedCommission)}</td></tr>`;

  // Adjustment detail
  const abody = document.getElementById('adjustBody');
  let rows = [];
  rows.push(['原始佣金', fmtW(r.rawCommission), '—', fmtW(r.rawCommission)]);
  if (r.capHit) rows.push(['封頂扣減', fmtW(r.rawCommission), '上限 ' + fmtW(config.bonusCap), fmtW(r.cappedCommission)]);
  if (r.retroactiveAddition > 0) rows.push(['追溯補發', fmtW(r.cappedCommission), '+' + fmtW(r.retroactiveAddition), fmtW(r.cappedCommission + r.retroactiveAddition)]);
  rows.push(['KPI 調節', fmtW(r.cappedCommission + r.retroactiveAddition), (config.kpiScore * config.kpiWeight / 100 * 100).toFixed(0) + '%', fmtW(r.kpiAdjusted)]);
  if (config.behaviorMod !== 1.0) rows.push(['行為職能係數', fmtW(r.kpiAdjusted), '×' + config.behaviorMod.toFixed(2), fmtW(r.behaviorAdjusted)]);
  rows.push(['品質調節', fmtW(r.behaviorAdjusted), r.qualityNote, fmtW(r.qualityAdjusted)]);
  if (r.totalClawback > 0) rows.push(['Clawback 追回', fmtW(r.qualityAdjusted), '-' + fmtW(r.totalClawback), fmtW(r.qualityAdjusted - r.totalClawback)]);
  rows.push(['最終獎金', '', '', fmtW(r.finalBonus)]);
  abody.innerHTML = rows.map((r, i) => {
    const isLast = i === rows.length - 1;
    const isDed = r[2].startsWith('-') || r[0] === 'Clawback 追回' || r[0] === '封頂扣減';
    return `<tr class="${isLast ? 'total-row' : (isDed ? 'deduction-row' : '')}"><td>${r[0]}</td><td class="r">${r[1]}</td><td class="r">${r[2]}</td><td class="r">${r[3]}</td></tr>`;
  }).join('');

  // Health check
  let h = '<div class="health-meter">';
  const laborOk = r.laborRate <= 50;
  h += `<div class="health-item ${laborOk ? 'success-box' : 'danger-box'}"><div class="val">${r.laborRate.toFixed(1)}%</div><div>勞動分配率 ${laborOk ? '健康' : '過高'}</div></div>`;
  const compaOk = r.compaRatio >= 0.8;
  h += `<div class="health-item ${compaOk ? 'success-box' : 'danger-box'}"><div class="val">${r.compaRatio.toFixed(2)}</div><div>Compa-Ratio ${compaOk ? '正常' : '偏低'}</div></div>`;
  const wageOk = r.totalPayMonthly * 10000 >= 29500;
  h += `<div class="health-item ${wageOk ? 'success-box' : 'danger-box'}"><div class="val">${fmt(r.totalPayMonthly * 10000)}/月</div><div>最低工資 ${wageOk ? '合規' : '低於29,500'}</div></div>`;
  h += `<div class="health-item success-box"><div class="val">${(r.tco > 0 ? (r.actual / r.tco).toFixed(1) : 0)}x</div><div>營收/人事成本比</div></div>`;
  h += '</div>';

  // Industry benchmark
  const saasMin = 30, saasMax = 50;
  const manufMin = 5, manufMax = 15;
  const retailMin = 10, retailMax = 15;
  h += `<div class="info-box"><strong>產業基準對照</strong>：SaaS ${saasMin}%-${saasMax}% | 製造業 ${manufMin}%-${manufMax}% | 零售業 ${retailMin}%-${retailMax}%`
    + ` ｜ 你當前 ${r.laborRate.toFixed(1)}% `
    + (r.laborRate > saasMax ? `（高於 SaaS 上限）` : r.laborRate < saasMin ? `（低於 SaaS 下限）` : `（在 SaaS 合理區間內）`)
    + '</div>';

  // Pay mix suggestion
  if (config.jobType?.includes('上山型')) {
    h += `<div class="info-box"><strong>薪獎比建議</strong>：上山型（業務開發）建議 40% 固定 : 60% 變動`
      + ` ｜ 目前固定 ${(config.baseSalary / (config.baseSalary + config.targetBonus) * 100).toFixed(0)}% : 變動 ${(config.targetBonus / (config.baseSalary + config.targetBonus) * 100).toFixed(0)}%</div>`;
  }

  if (r.laborRate > 61) h += '<div class="danger-box">勞動分配率超過 61%，經營警訊！</div>';
  if (!wageOk) h += '<div class="danger-box">扣回後月薪低於 29,500 元，違反勞基法！</div>';
  if (r.capHit) h += `<div class="warning-box">已觸及獎金上限 ${fmtW(config.bonusCap)}。</div>`;
  if (r.actual > r.sweetSpot && r.sweetSpot > 0) {
    h += `<div class="warning-box">實際業績已超過甜蜜點，邊際提撥率已從 ${r.tiers.filter(t => t.cls === 'accelerate-row' || t.cls === '')[0]?.rate || '—'} 降至 ${config.decelRate}%。</div>`;
  }

  document.getElementById('healthCheck').innerHTML = h;
}

// ── Plan Operations ──
window.newPlan = function() {
  const def = getDefaultPlan();
  renderForm(def.config);
  document.getElementById('planName').value = def.name;
  currentPlanId = null;
  document.querySelectorAll('.plan-item').forEach(el => el.classList.remove('active'));
  doCalculate();
};

window.savePlan = async function() {
  if (!currentUser) return;
  const name = document.getElementById('planName').value || '未命名方案';
  const config = readForm();
  try {
    const saved = await dbSavePlan(currentPlanId, name, '', config);
    currentPlanId = saved.id;
    await refreshPlanList();
  } catch (e) {
    alert('儲存失敗：' + e.message);
  }
};

window.loadPlan = async function(id) {
  const plan = plans.find(p => p.id === id);
  if (!plan) return;
  currentPlanId = plan.id;
  document.getElementById('planName').value = plan.name || '';
  renderForm(plan.config);
  document.querySelectorAll('.plan-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.plan-item[data-id="${id}"]`)?.classList.add('active');
  doCalculate();
};

// ── Comparison ──
window.comparePlans = function() {
  const allResults = [];
  const allNames = [];
  const allConfigs = [];

  // Current plan
  const curConfig = readForm();
  allConfigs.push(curConfig);
  allNames.push(document.getElementById('planName').value || '目前方案');
  allResults.push(calculate(curConfig));

  // Select 1-2 plans from list
  const avail = plans.filter(p => p.id !== currentPlanId);
  if (avail.length === 0) {
    alert('請先新增或儲存其他方案以進行比較');
    return;
  }

  const selected = avail.slice(0, 2);
  for (const p of selected) {
    allConfigs.push(p.config);
    allNames.push(p.name);
    allResults.push(calculate(p.config));
  }

  renderComparison(allResults, allNames, allConfigs);
};

function renderComparison(results, names, configs) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

  overlay.innerHTML = `
    <div class="modal">
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      <h2>📊 方案比較</h2>
      <div class="compare-grid">
        ${results.map((r, i) => `
          <div class="compare-card">
            <h4>${names[i]}</h4>
            <div class="stat"><span>原始佣金</span><span class="v">${fmtW(r.rawCommission)}</span></div>
            <div class="stat"><span>最終獎金</span><span class="v">${fmtW(r.finalBonus)}</span></div>
            <div class="stat"><span>實領年薪</span><span class="v">${fmtW(r.totalPay)}</span></div>
            <div class="stat"><span>達成率</span><span class="v">${(r.achieveRate * 100).toFixed(1)}%</span></div>
            <div class="stat"><span>勞動分配率</span><span class="v">${r.laborRate.toFixed(1)}%</span></div>
            <div class="stat"><span>Compa-Ratio</span><span class="v">${r.compaRatio.toFixed(2)}</span></div>
            <div class="stat"><span>甜蜜點獎金</span><span class="v">${fmtW(r.sweetBonus)}</span></div>
            <div class="stat"><span>邊際提撥率</span><span class="v">${r.marginalRate.toFixed(1)}%</span></div>
            <div class="stat" style="border-bottom:none"><span>Clawback</span><span class="v">${r.totalClawback > 0 ? '-' + fmtW(r.totalClawback) : 'NT$0'}</span></div>
            ${i === 0 ? '<div class="best">目前方案</div>' : ''}
          </div>
        `).join('')}
      </div>
      <div style="margin-top:16px;text-align:right;display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn" onclick="window.exportComparisonCSV()">📥 匯出 CSV 比較</button>
        <button class="btn" onclick="window.exportPDF()">🖨️ 列印</button>
        <button class="btn" onclick="this.closest('.modal-overlay').remove()">關閉</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Store for export
  window._comparisonResults = results;
  window._comparisonNames = names;
}

// ── Export ──
window.exportCSV = function() {
  const config = readForm();
  const result = calculate(config);
  const name = document.getElementById('planName').value || '方案';
  doExportCSV(result, config, name);
};

window.exportPDF = function() {
  doExportPDF();
};

window.exportComparisonCSV = function() {
  if (window._comparisonResults && window._comparisonNames) {
    exportComparisonCSV(window._comparisonResults, window._comparisonNames);
  }
};

// ── Tutorial ──
const tutorialSteps = [
  { title: '歡迎使用獎金模擬器', desc: '這是一個幫你設計薪酬方案的工具。左側邊欄管理方案，中間填數據，右邊看結果。我們用 5 步驟帶你走一遍。' },
  { title: '1️⃣ 輸入基本資料', desc: '在「基本設定」填入底薪、預期獎金、法定成本。再到「業績目標」輸入年度目標和實際達成。這些是計算的基礎。' },
  { title: '2️⃣ 設定階梯門檻', desc: '「階梯門檻設定」可以自由增減業績區間。每個區間設定一個門檻（萬）和提撥率（%）。提撥率應由低到高遞增。' },
  { title: '3️⃣ 甜蜜點與封頂', desc: '「甜蜜點」是績效的最佳區間，超過後提撥率會降低。獎金上限設為 0 表示不封頂。按「計算獎金」看右邊結果。' },
  { title: '4️⃣ 儲存與比較', desc: '上方工具列可「儲存」方案到雲端。存多個方案後按「比較」可以並排對比。還可以匯出 CSV 或 PDF。' }
];
let tutorialStep = 0;

function showTutorial(firstTime) {
  const overlay = document.getElementById('tutorialOverlay');
  if (!overlay) return;
  if (firstTime && localStorage.getItem('tutorialDone')) return;
  overlay.classList.remove('hidden');
  tutorialStep = 0;
  renderTutorialStep();
}
window.showTutorial = showTutorial;

function renderTutorialStep() {
  const step = tutorialSteps[tutorialStep];
  document.getElementById('tutorialStep').textContent = `步驟 ${tutorialStep + 1} / ${tutorialSteps.length}`;
  document.getElementById('tutorialTitle').textContent = step.title;
  document.getElementById('tutorialDesc').textContent = step.desc;
  document.getElementById('tutorialPrev').style.display = tutorialStep === 0 ? 'none' : '';
  document.getElementById('tutorialNext').textContent = tutorialStep === tutorialSteps.length - 1 ? '開始使用' : '下一步';
}

document.getElementById('tutorialNext')?.addEventListener('click', function() {
  if (tutorialStep < tutorialSteps.length - 1) {
    tutorialStep++;
    renderTutorialStep();
  } else {
    document.getElementById('tutorialOverlay').classList.add('hidden');
    localStorage.setItem('tutorialDone', '1');
  }
});

document.getElementById('tutorialPrev')?.addEventListener('click', function() {
  if (tutorialStep > 0) {
    tutorialStep--;
    renderTutorialStep();
  }
});

document.getElementById('tutorialSkip')?.addEventListener('click', function() {
  document.getElementById('tutorialOverlay').classList.add('hidden');
  localStorage.setItem('tutorialDone', '1');
});
