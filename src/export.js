export function exportCSV(result, config, name) {
  const rows = [
    ['指標', '數值'],
    ['方案名稱', name],
    ['底薪(萬)', config.baseSalary],
    ['預期獎金(萬)', config.targetBonus],
    ['年度目標(萬)', config.quota],
    ['實際達成(萬)', config.actual],
    ['達成率', (result.achieveRate * 100).toFixed(1) + '%'],
    ['原始佣金(萬)', result.rawCommission.toFixed(2)],
    ['封頂扣減(萬)', result.capDeduction.toFixed(2)],
    ['最終獎金(萬)', result.finalBonus.toFixed(2)],
    ['實領年薪(萬)', result.totalPay.toFixed(2)],
    ['勞動分配率', result.laborRate.toFixed(1) + '%'],
    ['Compa-Ratio', result.compaRatio.toFixed(2)],
    ['甜蜜點獎金(萬)', result.sweetBonus.toFixed(2)],
    ['距甜蜜點', (result.sweetGap >= 0 ? '+' : '') + result.sweetGap.toFixed(1) + '%'],
    ['邊際提撥率', result.marginalRate.toFixed(1) + '%'],
    ['Clawback扣回(萬)', result.totalClawback.toFixed(2)],
    ['KPI調節', '得分' + config.kpiScore + ' × 權重' + config.kpiWeight + '%'],
    [''],
    ['--- 階梯明細 ---'],
    ['區間', '業績金額(萬)', '提撥率', '獎金(萬)']
  ];
  for (const t of result.tiers) {
    rows.push([t.name, t.amt.toFixed(2), t.rate, t.bonus.toFixed(2)]);
  }
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name + '_獎金模擬.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

export function exportPDF(name) {
  window.print();
}

export function exportComparisonCSV(results, names) {
  const metrics = [
    '達成率', '原始佣金', '封頂扣減', '最終獎金', '實領年薪',
    '勞動分配率', 'Compa-Ratio', '甜蜜點獎金', '距甜蜜點', '邊際提撥率'
  ];
  const rows = [['指標', ...names]];
  const vals = results.map(r => [
    (r.achieveRate * 100).toFixed(1) + '%',
    r.rawCommission.toFixed(2),
    r.capDeduction.toFixed(2),
    r.finalBonus.toFixed(2),
    r.totalPay.toFixed(2),
    r.laborRate.toFixed(1) + '%',
    r.compaRatio.toFixed(2),
    r.sweetBonus.toFixed(2),
    (r.sweetGap >= 0 ? '+' : '') + r.sweetGap.toFixed(1) + '%',
    r.marginalRate.toFixed(1) + '%'
  ]);
  for (let i = 0; i < metrics.length; i++) {
    rows.push([metrics[i], ...vals.map(v => v[i])]);
  }
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '方案比較.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}
