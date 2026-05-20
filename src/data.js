// ── 產業與部門資料模型 ──

export const INDUSTRIES = {
  '科技/軟體/電商': ['業務', '行銷', '技術/研發', '專案/交付', '職能', '客服', '採購'],
  '製造業（含代工）': ['業務', '技術/研發', '生產', '物流', '職能', '採購', '品保/風控'],
  '餐飲業': ['行銷', '門市/營運', '生產', '物流', '職能', '客服'],
  '零售/服務業': ['業務', '行銷', '門市/營運', '物流', '職能', '客服', '採購'],
  '金融/保險/證券': ['業務', '技術/研發', '專案/交付', '職能', '客服', '品保/風控'],
  '長照/醫療/社福': ['行銷', '門市/營運', '技術/研發', '物流', '職能', '客服', '採購', '品保/風控'],
  '建築/營造/不動產': ['業務', '技術/研發', '專案/交付', '生產', '物流', '職能', '採購', '品保/風控'],
  '專業顧問業': ['業務', '行銷', '技術/研發', '專案/交付', '職能', '客服'],
  '其他': ['業務', '行銷', '門市/營運', '技術/研發', '專案/交付', '生產', '物流', '職能', '客服', '採購', '品保/風控']
};

export const DEPT_TYPE = {
  '業務': '上山型', '行銷': '上山型', '門市/營運': '上山型',
  '技術/研發': '下山型', '專案/交付': '下山型', '生產': '下山型', '物流': '下山型',
  '職能': '平路型', '客服': '平路型', '採購': '平路型', '品保/風控': '平路型'
};

export const DEPT_RATIOS = {
  '業務':        { fixed: 40, behavior: 10, performance: 50, type: '上山型', desc: '開發客戶、創造營收' },
  '行銷':        { fixed: 50, behavior: 10, performance: 40, type: '上山型', desc: '創造流量、產生商機' },
  '門市/營運':    { fixed: 50, behavior: 10, performance: 40, type: '上山型', desc: '現場轉化、服務體驗' },
  '技術/研發':    { fixed: 70, behavior: 10, performance: 20, type: '下山型', desc: '解決問題、創造改善' },
  '專案/交付':    { fixed: 70, behavior: 10, performance: 20, type: '下山型', desc: '推進進度、完成驗收' },
  '生產':        { fixed: 80, behavior: 10, performance: 10, type: '下山型', desc: '穩定交付、提升效率' },
  '物流':        { fixed: 80, behavior: 10, performance: 10, type: '下山型', desc: '準時配送、降低異常' },
  '職能':        { fixed: 80, behavior: 10, performance: 10, type: '平路型', desc: '支援營運、降低錯誤' },
  '客服':        { fixed: 80, behavior: 10, performance: 10, type: '平路型', desc: '維護關係、提升留存' },
  '採購':        { fixed: 80, behavior: 10, performance: 10, type: '平路型', desc: '控制成本、穩定供應' },
  '品保/風控':    { fixed: 80, behavior: 10, performance: 10, type: '平路型', desc: '預防風險、改善制度' }
};

export const DEPT_SUBJECTS = {
  '業務': {
    base: ['業務底薪', '職級津貼', '外勤津貼'],
    behavior: ['拜訪獎金', '開發名單獎金', 'CRM 紀錄獎金'],
    performance: ['業績獎金', '毛利獎金', '回款獎金', '新客開發獎金'],
    bonus: ['業務團隊分紅', '季分紅', '年終獎金'],
    welfare: ['銷售競賽', '出國旅遊', '表揚大會', '培訓名額'],
    risks: ['毛利率', '回款率', '客訴率', '折扣權限', '退貨率']
  },
  '行銷': {
    base: ['行銷底薪', '專業技能津貼', '數位工具津貼'],
    behavior: ['內容產出獎金', '活動執行獎金', '投放優化獎金'],
    performance: ['有效商機獎金', '轉換率獎金', '投放 ROI 獎金'],
    bonus: ['品牌成長分紅', '季度績效分紅', '專案成果分紅'],
    welfare: ['學習津貼', '證照補助', '作品集獎勵'],
    risks: ['有效商機率', '轉換率', '投放 ROI', '名單品質', '業務成交追蹤']
  },
  '門市/營運': {
    base: ['門市底薪', '店長管理津貼', '營運管理津貼'],
    behavior: ['服務標準獎金', '陳列維護獎金', '庫存盤點獎金'],
    performance: ['門市營收獎金', '客單價獎金', '損耗降低獎金'],
    bonus: ['門市盈餘分紅', '區域績效分紅', '年度營運分紅'],
    welfare: ['輪班津貼', '伙食津貼', '久任獎金'],
    risks: ['服務品質', '損耗率', '庫存準確率', '客訴率', '標準化執行']
  },
  '技術/研發': {
    base: ['技術底薪', '職級津貼', '專業能力津貼'],
    behavior: ['技術分享獎金', '文件沉澱獎金', '跨部門支援獎金'],
    performance: ['專案達成獎金', '技術突破獎金', '品質改善獎金', '降本增效獎金'],
    bonus: ['專案分紅', '公司績效分紅', '年終獎金'],
    welfare: ['培訓補助', '證照補助', '技術競賽', '專利獎勵'],
    risks: ['交付時效', '品質標準', '成果驗收', '返工率', '知識沉澱']
  },
  '專案/交付': {
    base: ['專案底薪', '專案管理津貼', '客戶溝通津貼'],
    behavior: ['進度回報獎金', '跨部門協作獎金', '變更控管獎金'],
    performance: ['準時交付獎金', '驗收完成獎金', '成本控制獎金'],
    bonus: ['專案毛利分紅', '季度績效分紅', '大案獎金'],
    welfare: ['專案津貼', '出差津貼', '證照補助'],
    risks: ['驗收結果', '專案毛利', '變更控管', '客戶滿意度', '逾期率']
  },
  '生產': {
    base: ['基本工資', '職務津貼', '環境津貼', '危險加給'],
    behavior: ['全勤獎金', 'SOP 遵守獎金', '改善提案獎金'],
    performance: ['品質獎金', '產能達成獎金', '良率獎金', '安全生產獎金'],
    bonus: ['生產績效分紅', '年中分紅', '年終獎金'],
    welfare: ['久任獎金', '生日禮金', '三節獎金', '學習補助'],
    risks: ['良率', '返工率', '交期', '安全事故', 'SOP 違規']
  },
  '物流': {
    base: ['基本工資', '職務津貼', '證照獎金'],
    behavior: ['全勤獎金', '配合出車獎金', '無違規獎金', '安全駕駛獎金'],
    performance: ['準時送達獎金', '配送品質獎金', '客訴改善獎金', '油耗節省獎金'],
    bonus: ['物流績效分紅', '年中分紅', '年終獎金'],
    welfare: ['久任獎金', '生日禮金', '三節獎金', '其他福利'],
    risks: ['準時率', '客訴率', '交通違規', '事故紀錄', '油耗標準']
  },
  '職能': {
    base: ['職能底薪', '職務津貼', '專業證照津貼'],
    behavior: ['全勤獎金', '協作獎金', '服務品質獎金'],
    performance: ['準確率獎金', '時效達成獎金', '流程改善獎金'],
    bonus: ['公司績效分紅', '部門協作分紅', '年終獎金'],
    welfare: ['久任獎金', '生日禮金', '三節獎金', '學習補助'],
    risks: ['準確率', '時效', '協作品質', '違規紀錄', '重大疏失']
  },
  '客服': {
    base: ['客服底薪', '服務技能津貼', '系統操作津貼'],
    behavior: ['即時回應獎金', '客訴處理獎金', '主動關懷獎金'],
    performance: ['滿意度獎金', '客訴降低獎金', '續約/復購獎金'],
    bonus: ['續約分紅', '客戶留存分紅', '團隊服務分紅'],
    welfare: ['情緒勞動津貼', '輪班津貼', '心理支持福利'],
    risks: ['問題解決率', '滿意度', '客訴改善', '留存率', '回覆時效']
  },
  '採購': {
    base: ['採購底薪', '專業採購津貼', '供應鏈管理津貼'],
    behavior: ['供應商開發獎金', '比價議價獎金', '採購合規獎金'],
    performance: ['降本獎金', '準交率獎金', '品質達標獎金'],
    bonus: ['採購節約分紅', '季度績效分紅', '供應鏈改善分紅'],
    welfare: ['通訊津貼', '證照補助', '外勤津貼'],
    risks: ['品質', '交期', '供應穩定', '廉潔條件', '異常成本']
  },
  '品保/風控': {
    base: ['品保底薪', '稽核津貼', '風控專業津貼'],
    behavior: ['稽核執行獎金', '改善追蹤獎金', '標準化建置獎金'],
    performance: ['異常降低獎金', '合規達標獎金', '客訴降低獎金'],
    bonus: ['品質改善分紅', '風險預防分紅', '年度品質分紅'],
    welfare: ['專業證照補助', '稽核出差津貼', '專業訓練補助'],
    risks: ['改善閉環', '異常降低', '風險預防', '重大漏失', '合規結果']
  }
};

export const INDUSTRY_BENCHMARKS = {
  '科技/軟體/電商':     { laborRate: '30%-50%', grossMargin: '70%-90%' },
  '製造業（含代工）':    { laborRate: '5%-25%', grossMargin: '5%-20%', note: 'OEM純代工5-15%｜ODM設計代工15-25%' },
  '餐飲業':            { laborRate: '20%-25%', grossMargin: '60%-70%' },
  '零售/服務業':        { laborRate: '10%-15%', grossMargin: '15%-40%' },
  '金融/保險/證券':     { laborRate: '62%-64%', grossMargin: '極高' },
  '長照/醫療/社福':     { laborRate: '40%-60%', grossMargin: '高度變動' },
  '建築/營造/不動產':   { laborRate: '20%-35%', grossMargin: '20%-40%' },
  '專業顧問業':         { laborRate: '40%-60%', grossMargin: '高度變動' },
  '其他':              { laborRate: '20%-40%', grossMargin: '—' }
};

export const TYPE_DESCRIPTIONS = {
  '上山型': '重績效 — 獎開拓，結果越能由個人直接創造，浮動比例就越可拉高',
  '平路型': '重職能 — 獎穩定，流程效率與交付品質比刺激性重要',
  '下山型': '重技能 — 獎交付，技術能力與專案成果決定薪酬水位'
};

export const ONE_LINERS = {
  '業務': '不能只買業績，要同時買毛利與回款',
  '行銷': '不能只買曝光，要買有效商機與轉換',
  '門市/營運': '不能只買營收，要買服務、損耗控制與標準化',
  '技術/研發': '不能只買完成，要買突破、品質與知識沉澱',
  '專案/交付': '不能只買結案，要買驗收、毛利與客戶滿意',
  '生產': '不能只買產量，要買良率、安全與交期',
  '物流': '不能只買速度，要買準時、安全與低客訴',
  '職能': '不能只買出勤，要買準確、效率與協作',
  '客服': '不能只買接待量，要買解決率、滿意度與留存',
  '採購': '不能只買降本，要買品質、交期與廉潔',
  '品保/風控': '不能只買抓錯，要買改善閉環與風險預防'
};

// ── 型態預設比例（自訂部門用） ──
export const TYPE_RATIOS = {
  '上山型': { fixed: 40, behavior: 10, performance: 50 },
  '平路型': { fixed: 80, behavior: 10, performance: 10 },
  '下山型': { fixed: 70, behavior: 10, performance: 20 }
};

// ── 型態預設科目（自訂部門用） ──
export const TYPE_SUBJECTS = {
  '上山型': {
    base: ['基本底薪', '職級津貼'],
    behavior: ['業務行為獎金', '客戶開發獎金'],
    performance: ['業績獎金', '目標達成獎金'],
    bonus: ['團隊分紅', '年終獎金'],
    welfare: ['競賽獎勵', '培訓補助'],
    risks: ['業績達成率', '客戶滿意度']
  },
  '平路型': {
    base: ['基本薪資', '職務津貼'],
    behavior: ['全勤獎金', '協作獎金'],
    performance: ['效率獎金', '品質獎金'],
    bonus: ['績效分紅', '年終獎金'],
    welfare: ['久任獎金', '三節獎金'],
    risks: ['準確率', '時效']
  },
  '下山型': {
    base: ['專業底薪', '技能津貼'],
    behavior: ['專案執行獎金', '協作獎金'],
    performance: ['交付獎金', '品質獎金'],
    bonus: ['專案分紅', '年終獎金'],
    welfare: ['證照補助', '專業訓練'],
    risks: ['交付時效', '品質標準']
  }
};

export const ALL_DEPTS = Object.keys(DEPT_RATIOS);
export const JOB_TYPES = ['上山型', '平路型', '下山型'];

let _idc = 0;
export function genDeptId() {
  return `d${++_idc}_${Date.now().toString(36)}`;
}

export function getIndustryDepts(ind) {
  return (INDUSTRIES[ind] || []).map(name => ({
    id: genDeptId(), name, type: DEPT_TYPE[name] || '平路型', enabled: true
  }));
}

export function isKnownDept(name) { return !!DEPT_RATIOS[name]; }

export function getDeptRatios(name, type) {
  if (isKnownDept(name)) return DEPT_RATIOS[name];
  return TYPE_RATIOS[type] || TYPE_RATIOS['平路型'];
}

export function getDeptSubjects(name, type) {
  if (DEPT_SUBJECTS[name]) return JSON.parse(JSON.stringify(DEPT_SUBJECTS[name]));
  return JSON.parse(JSON.stringify(TYPE_SUBJECTS[type] || TYPE_SUBJECTS['平路型']));
}

export function createDeptConfig(deptId, name, type, annualTotal) {
  const r = getDeptRatios(name, type);
  const fixedAnnual = Math.round(annualTotal * r.fixed / 100);
  const behaviorAnnual = Math.round(annualTotal * r.behavior / 100);
  const perfAnnual = Math.round(annualTotal * r.performance / 100);
  const monthlyBase = Math.round(fixedAnnual / 12);
  const subj = getDeptSubjects(name, type);
  return { deptName: name, type: r.type || type, desc: r.desc || '', annualTotal, fixedRatio: r.fixed, behaviorRatio: r.behavior, performanceRatio: r.performance, monthlyBase, fixedAnnual, behaviorAnnual, perfAnnual, subjects: subj, enabled: true };
}

// ── 職等職級對照 ──
export const RANK_TITLES = {
  0: '試用期', 1: '助理', 2: '專員', 3: '副課長', 4: '課長',
  5: '副理', 6: '經理', 7: '資深經理', 8: '協理', 9: '副總經理', 10: '總經理'
};

export const JOB_FAMILIES = ['管理系', '業務開發', '技術研發', '後勤支援'];

export const DEFAULT_GRADE_MATRIX = {
  '管理系': [
    { grade: 0, title: '試用期人員', levels: [{ level: 0, min: 28000, max: 30000 }] },
    { grade: 1, title: '助理', levels: [{ level: 1, min: 30000, max: 31000 }, { level: 2, min: 30500, max: 32000 }, { level: 3, min: 31000, max: 33000 }] },
    { grade: 2, title: '專員', levels: [{ level: 1, min: 32000, max: 35000 }, { level: 2, min: 33000, max: 36000 }, { level: 3, min: 34000, max: 37000 }] },
    { grade: 3, title: '副課長', levels: [{ level: 1, min: 35000, max: 38000 }, { level: 2, min: 36000, max: 39000 }, { level: 3, min: 37000, max: 40000 }] },
    { grade: 4, title: '課長', levels: [{ level: 1, min: 38000, max: 41000 }, { level: 2, min: 39000, max: 42000 }, { level: 3, min: 40000, max: 43000 }] },
    { grade: 5, title: '副理', levels: [{ level: 1, min: 38000, max: 40000 }, { level: 2, min: 39000, max: 41000 }, { level: 3, min: 40000, max: 42000 }] },
    { grade: 6, title: '經理', levels: [{ level: 1, min: 41000, max: 43000 }, { level: 2, min: 42000, max: 45000 }, { level: 3, min: 43000, max: 47000 }] },
    { grade: 7, title: '資深經理', levels: [{ level: 1, min: 44000, max: 47000 }, { level: 2, min: 45000, max: 48000 }, { level: 3, min: 46000, max: 49000 }] },
    { grade: 8, title: '協理', levels: [{ level: 1, min: 47000, max: 55000 }, { level: 2, min: 48000, max: 58000 }, { level: 3, min: 49000, max: 60000 }] },
    { grade: 9, title: '副總經理', levels: [{ level: 1, min: 50000, max: 65000 }, { level: 2, min: 55000, max: 75000 }, { level: 3, min: 60000, max: 80000 }] },
    { grade: 10, title: '總經理', levels: [{ level: 1, min: 70000, max: 85000 }, { level: 2, min: 80000, max: 95000 }, { level: 3, min: 90000, max: 120000 }] }
  ],
  '業務開發': [
    { grade: 0, title: '試用期人員', levels: [{ level: 0, min: 28000, max: 30000 }] },
    { grade: 1, title: '助理', levels: [{ level: 1, min: 28000, max: 30500 }, { level: 2, min: 29000, max: 31500 }, { level: 3, min: 30000, max: 32500 }] },
    { grade: 2, title: '專員', levels: [{ level: 1, min: 30000, max: 34000 }, { level: 2, min: 31000, max: 35500 }, { level: 3, min: 32000, max: 37000 }] },
    { grade: 3, title: '高級專員', levels: [{ level: 1, min: 33000, max: 37000 }, { level: 2, min: 34000, max: 38500 }, { level: 3, min: 35000, max: 40000 }] },
    { grade: 4, title: '資深專員', levels: [{ level: 1, min: 36000, max: 40000 }, { level: 2, min: 37000, max: 42000 }, { level: 3, min: 38000, max: 43000 }] },
    { grade: 5, title: '業務副理', levels: [{ level: 1, min: 38000, max: 43000 }, { level: 2, min: 39000, max: 45000 }, { level: 3, min: 40000, max: 46000 }] },
    { grade: 6, title: '業務經理', levels: [{ level: 1, min: 40000, max: 46000 }, { level: 2, min: 41000, max: 48000 }, { level: 3, min: 42000, max: 50000 }] },
    { grade: 7, title: '資深業務經理', levels: [{ level: 1, min: 44000, max: 51000 }, { level: 2, min: 45000, max: 53000 }, { level: 3, min: 46000, max: 55000 }] },
    { grade: 8, title: '業務協理', levels: [{ level: 1, min: 48000, max: 58000 }, { level: 2, min: 50000, max: 62000 }, { level: 3, min: 52000, max: 65000 }] },
    { grade: 9, title: '業務副總', levels: [{ level: 1, min: 55000, max: 70000 }, { level: 2, min: 60000, max: 80000 }, { level: 3, min: 65000, max: 90000 }] },
    { grade: 10, title: '總經理', levels: [{ level: 1, min: 70000, max: 85000 }, { level: 2, min: 80000, max: 95000 }, { level: 3, min: 90000, max: 120000 }] }
  ],
  '技術研發': [
    { grade: 0, title: '試用期人員', levels: [{ level: 0, min: 28000, max: 30000 }] },
    { grade: 1, title: '助理工程師', levels: [{ level: 1, min: 29000, max: 32000 }, { level: 2, min: 29500, max: 33000 }, { level: 3, min: 30000, max: 34000 }] },
    { grade: 2, title: '初級工程師', levels: [{ level: 1, min: 31000, max: 35000 }, { level: 2, min: 32000, max: 36500 }, { level: 3, min: 33000, max: 38000 }] },
    { grade: 3, title: '中級工程師', levels: [{ level: 1, min: 34000, max: 39000 }, { level: 2, min: 35000, max: 40500 }, { level: 3, min: 36000, max: 42000 }] },
    { grade: 4, title: '高級工程師', levels: [{ level: 1, min: 37000, max: 43000 }, { level: 2, min: 38000, max: 45000 }, { level: 3, min: 39000, max: 47000 }] },
    { grade: 5, title: '資深工程師', levels: [{ level: 1, min: 40000, max: 48000 }, { level: 2, min: 42000, max: 50000 }, { level: 3, min: 44000, max: 52000 }] },
    { grade: 6, title: '專業經理', levels: [{ level: 1, min: 45000, max: 53000 }, { level: 2, min: 47000, max: 56000 }, { level: 3, min: 49000, max: 58000 }] },
    { grade: 7, title: '資深專業經理', levels: [{ level: 1, min: 50000, max: 59000 }, { level: 2, min: 52000, max: 62000 }, { level: 3, min: 54000, max: 65000 }] },
    { grade: 8, title: '專業協理', levels: [{ level: 1, min: 55000, max: 66000 }, { level: 2, min: 57000, max: 70000 }, { level: 3, min: 60000, max: 75000 }] },
    { grade: 9, title: '總工程師', levels: [{ level: 1, min: 65000, max: 80000 }, { level: 2, min: 70000, max: 90000 }, { level: 3, min: 75000, max: 100000 }] },
    { grade: 10, title: '總經理', levels: [{ level: 1, min: 70000, max: 85000 }, { level: 2, min: 80000, max: 95000 }, { level: 3, min: 90000, max: 120000 }] }
  ],
  '後勤支援': [
    { grade: 0, title: '試用期人員', levels: [{ level: 0, min: 28000, max: 30000 }] },
    { grade: 1, title: '助理', levels: [{ level: 1, min: 28000, max: 31000 }, { level: 2, min: 28500, max: 32000 }, { level: 3, min: 29000, max: 33000 }] },
    { grade: 2, title: '專員', levels: [{ level: 1, min: 30000, max: 34000 }, { level: 2, min: 31000, max: 35500 }, { level: 3, min: 32000, max: 37000 }] },
    { grade: 3, title: '高級專員', levels: [{ level: 1, min: 33000, max: 37000 }, { level: 2, min: 34000, max: 38500 }, { level: 3, min: 35000, max: 40000 }] },
    { grade: 4, title: '資深專員', levels: [{ level: 1, min: 36000, max: 40000 }, { level: 2, min: 37000, max: 42000 }, { level: 3, min: 38000, max: 43000 }] },
    { grade: 5, title: '專業副理', levels: [{ level: 1, min: 38000, max: 43000 }, { level: 2, min: 39000, max: 45000 }, { level: 3, min: 40000, max: 46000 }] },
    { grade: 6, title: '專業經理', levels: [{ level: 1, min: 40000, max: 46000 }, { level: 2, min: 41000, max: 48000 }, { level: 3, min: 42000, max: 50000 }] },
    { grade: 7, title: '資深專業經理', levels: [{ level: 1, min: 44000, max: 51000 }, { level: 2, min: 45000, max: 53000 }, { level: 3, min: 46000, max: 55000 }] },
    { grade: 8, title: '專業協理', levels: [{ level: 1, min: 48000, max: 58000 }, { level: 2, min: 50000, max: 62000 }, { level: 3, min: 52000, max: 65000 }] },
    { grade: 9, title: '副總經理', levels: [{ level: 1, min: 55000, max: 70000 }, { level: 2, min: 60000, max: 80000 }, { level: 3, min: 65000, max: 90000 }] },
    { grade: 10, title: '總經理', levels: [{ level: 1, min: 70000, max: 85000 }, { level: 2, min: 80000, max: 95000 }, { level: 3, min: 90000, max: 120000 }] }
  ]
};

// ── 職系預設薪酬組合 ──
export const FAMILY_PAYMIX = {
  '管理系': { fixed: 80, float: 20, desc: '以保底底薪為主，強調管理責任' },
  '業務開發': { fixed: 40, float: 60, desc: '責任底薪+高變動，業績驅動' },
  '技術研發': { fixed: 70, float: 30, desc: '底薪+職務津貼，保障專業專注度' },
  '後勤支援': { fixed: 80, float: 20, desc: '底薪+職務加給，重視流程穩定' }
};

// ── 部門型態→職系對應 ──
export const DEPT_JOB_FAMILY = { '上山型': '業務開發', '平路型': '管理系', '下山型': '技術研發' };
export function getJobFamilyForDept(deptType) { return DEPT_JOB_FAMILY[deptType] || '管理系'; }

// ── 建立預設人員分配（自動分層） ──
export function createDefaultAllocation(headcount, deptName, deptType, gradeMatrix) {
  const jf = getJobFamilyForDept(deptType);
  const grades = gradeMatrix[jf] || [];
  if (!grades.length || headcount <= 0) return [];
  const typeRatios = { '上山型': { fixed: 40, behavior: 10, performance: 50 }, '平路型': { fixed: 80, behavior: 10, performance: 10 }, '下山型': { fixed: 70, behavior: 10, performance: 20 } };
  const baseRatios = typeRatios[deptType] || typeRatios['平路型'];
  let tiers = [];
  if (headcount <= 3) {
    if (headcount >= 1) tiers.push({ label: '管理層', offset: -2, count: 1 });
    if (headcount >= 2) tiers.push({ label: '資深', offset: -1, count: 1 });
    if (headcount >= 3) tiers.push({ label: '基層員工', offset: 0, count: headcount - 2 });
  } else if (headcount <= 8) {
    tiers = [
      { label: '管理層', offset: -3, count: 1 },
      { label: '中階', offset: -2, count: Math.max(1, Math.round(headcount * 0.2)) },
      { label: '基層主管', offset: -1, count: Math.max(1, Math.round(headcount * 0.3)) },
      { label: '基層員工', offset: 0, count: headcount }
    ];
    tiers[3].count = Math.max(1, headcount - tiers.slice(0, 3).reduce((s, t) => s + t.count, 0));
  } else {
    tiers = [
      { label: '管理層', offset: -3, count: 1 },
      { label: '中階', offset: -2, count: Math.max(2, Math.round(headcount * 0.15)) },
      { label: '基層主管', offset: -1, count: Math.max(3, Math.round(headcount * 0.25)) },
      { label: '基層員工', offset: 0, count: headcount }
    ];
    tiers[3].count = Math.max(1, headcount - tiers.slice(0, 3).reduce((s, t) => s + t.count, 0));
  }
  const subj = getDeptSubjects(deptName, deptType);
  const withAmounts = (names, total) => names.map((n, i, a) => ({ name: n, amount: i === a.length - 1 ? total - Math.round(total / a.length) * (a.length - 1) : Math.round(total / a.length) }));
  return tiers.map(t => {
    const idx = t.offset < 0 ? Math.max(0, grades.length + t.offset) : Math.min(t.offset, grades.length - 1);
    const g = grades[Math.min(idx, grades.length - 1)];
    const lvl = g ? g.levels[Math.floor(g.levels.length / 2)] : null;
    const midMonthly = lvl ? Math.round((lvl.min + lvl.max) / 2) : 30000;
    const annualTotal = midMonthly * 14; // 12 months + 2 months bonus
    const fixedAnnual = Math.round(annualTotal * baseRatios.fixed / 100);
    const behaviorAnnual = Math.round(annualTotal * baseRatios.behavior / 100);
    const perfAnnual = Math.round(annualTotal * baseRatios.performance / 100);
    return {
      grade: g ? g.grade : -1, level: lvl ? lvl.level : 1, title: g ? g.title : t.label,
      headcount: t.count, annualTotal,
      fixedRatio: baseRatios.fixed, behaviorRatio: baseRatios.behavior, performanceRatio: baseRatios.performance,
      fixedAnnual, behaviorAnnual, perfAnnual, monthlyBase: Math.round(fixedAnnual / 12),
      subjects: {
        base: withAmounts(subj.base, fixedAnnual),
        behavior: withAmounts(subj.behavior, behaviorAnnual),
        performance: withAmounts(subj.performance, perfAnnual)
      }
    };
  });
}

// 向後相容
export const DEFAULT_GRADES = [
  { level: '實習/工讀', min: 27470, max: 35000 },
  { level: '助理', min: 30000, max: 40000 },
  { level: '專員', min: 35000, max: 50000 },
  { level: '資深專員', min: 45000, max: 65000 },
  { level: '主任/組長', min: 55000, max: 80000 },
  { level: '副理', min: 65000, max: 95000 },
  { level: '經理', min: 80000, max: 120000 },
  { level: '協理/總監', min: 100000, max: 150000 },
  { level: '副總/總經理', min: 140000, max: 250000 }
];

// ── 預算佔用率健康判斷 ──
export function calcHealth(laborRatio, bench) {
  if (!bench) return { text: '—', color: '#94a3b8', bg: '#f8fafc' };
  const range = parseRange(bench.laborRate);
  const r = laborRatio;
  if (r < range.min * 0.8) return { text: '⚠️ 偏低', color: '#f59e0b', bg: '#fffbeb' };
  if (r <= range.max) return { text: '✅ 很健康', color: '#10b981', bg: '#f0fdf4' };
  if (r <= range.max * 1.3) return { text: '⚡ 有問題', color: '#f97316', bg: '#fff7ed' };
  return { text: '🔴 有危險', color: '#ef4444', bg: '#fef2f2' };
}

export function parseRange(str) {
  if (!str) return { min: 20, max: 40 };
  const m = str.match(/([\d.]+)\s*-\s*([\d.]+)/);
  return m ? { min: parseFloat(m[1]), max: parseFloat(m[2]) } : { min: 20, max: 40 };
}

// ── 預設資料 ──
export function defaultData(ind) {
  const depts = getIndustryDepts(ind);
  const hc = {};
  depts.forEach(d => { hc[d.id] = 3; });
  const bench = INDUSTRY_BENCHMARKS[ind];
  const range = bench ? parseRange(bench.laborRate) : { min: 20, max: 40 };
  return {
    industry: ind, departments: depts, monthlyRevenue: 500,
    laborRatio: Math.round((range.min + range.max) / 2),
    headcounts: hc, deptConfigs: {},
    grades: JSON.parse(JSON.stringify(DEFAULT_GRADES)),
    gradeMatrix: JSON.parse(JSON.stringify(DEFAULT_GRADE_MATRIX)),
    activeJobFamily: '管理系', step: 1, planName: '未命名方案', planId: null
  };
}
