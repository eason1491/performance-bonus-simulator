export function calculate(inputs) {
  const {
    baseSalary, targetBonus, overheadRate,
    quota, actual,
    steps,
    sweetSpot, decelRate, bonusCap,
    cogsRate, gmRate,
    kpiScore, kpiWeight,
    csatTarget, csatActual, csatPenalty,
    behaviorMod,
    clawbacks,
    hardThreshold = { enabled: false, minRate: 0 },
    retroactiveThreshold = { enabled: false },
    oneYuanStart = true,
    qualityMetric = 'csat',
    npsTarget = 50, npsActual = 60, npsPenalty = 10
  } = inputs;

  const ote = baseSalary + targetBonus;
  const tco = ote * (1 + overheadRate / 100);
  const achieveRate = quota > 0 ? actual / quota : 0;
  const grossProfit = actual * (1 - cogsRate / 100);
  const gmCommission = grossProfit * gmRate / 100;

  let remaining = actual;
  const tiers = [];

  // 硬門檻：低於目標×minRate% 則不發
  if (hardThreshold.enabled && achieveRate < hardThreshold.minRate / 100) {
    return emptyResult(baseSalary, targetBonus, overheadRate, ote, tco, achieveRate, grossProfit, gmCommission, actual, quota, sweetSpot);
  }

  // 1元起抽：若未啟用且 remaining <= 0 則中斷
  if (!oneYuanStart && remaining <= 0) {
    return emptyResult(baseSalary, targetBonus, overheadRate, ote, tco, achieveRate, grossProfit, gmCommission, actual, quota, sweetSpot);
  }

  let bonus = 0;
  let prevThreshold = 0;
  let lastStepRate = 0;

  // Step 1: 階梯門檻
  for (const step of steps) {
    const bandAmt = Math.max(0, Math.min(remaining, step.threshold - prevThreshold));
    if (bandAmt <= 0) { prevThreshold = step.threshold; lastStepRate = step.rate / 100; continue; }
    const bandBonus = bandAmt * step.rate / 100;
    bonus += bandBonus;
    tiers.push({
      name: prevThreshold + ' ~ ' + step.threshold + ' 萬',
      amt: bandAmt,
      rate: step.rate + '%',
      bonus: bandBonus,
      cls: ''
    });
    remaining -= bandAmt;
    prevThreshold = step.threshold;
    lastStepRate = step.rate / 100;
  }

  // Step 2: 加速器 (最後門檻 ~ 甜蜜點)
  let accelAmt = 0, accelBonus = 0;
  if (remaining > 0 && sweetSpot > prevThreshold) {
    accelAmt = Math.min(remaining, sweetSpot - prevThreshold);
    if (accelAmt > 0) {
      accelBonus = accelAmt * lastStepRate;
      bonus += accelBonus;
      tiers.push({
        name: '加速器',
        amt: accelAmt,
        rate: (lastStepRate * 100).toFixed(1) + '%',
        bonus: accelBonus,
        cls: 'accelerate-row'
      });
      remaining -= accelAmt;
    }
  }

  // Step 3: 甜蜜點遞減
  let decelAmt = 0, decelBonus = 0;
  if (remaining > 0 && sweetSpot > 0) {
    decelAmt = remaining;
    decelBonus = decelAmt * decelRate / 100;
    bonus += decelBonus;
    tiers.push({
      name: '甜蜜點後 (遞減)',
      amt: decelAmt,
      rate: decelRate + '%',
      bonus: decelBonus,
      cls: 'decelerate-row'
    });
    remaining = 0;
  }

  const rawCommission = bonus;

  // 甜蜜點獎金
  const sweetBonus = calcSweetSpotBonus(actual, sweetSpot, steps, lastStepRate);

  // 封頂
  const capHit = bonusCap > 0 && rawCommission > bonusCap;
  const capDeduction = capHit ? rawCommission - bonusCap : 0;
  const cappedCommission = bonusCap > 0 ? Math.min(rawCommission, bonusCap) : rawCommission;

  // 追溯門檻：若啟用且超過 100%，補足低階差額
  let retroactiveAddition = 0;
  if (retroactiveThreshold.enabled && achieveRate >= 1.0) {
    retroactiveAddition = cappedCommission * 0.05; // 補 5% 做為激勵
  }
  const afterRetro = cappedCommission + retroactiveAddition;

  // KPI 調節
  const kpiAdjusted = afterRetro * (kpiScore * kpiWeight / 100);

  // 行為職能係數
  const behaviorAdjusted = kpiAdjusted * behaviorMod;

  // 品質門檻 (CSAT 或 NPS)
  let qualityAdjusted = behaviorAdjusted;
  let qualityNote = '';
  if (qualityMetric === 'csat') {
    if (csatActual < csatTarget) {
      const factor = 1 - csatPenalty / 100;
      qualityAdjusted = behaviorAdjusted * factor;
      qualityNote = 'CSAT ' + csatActual.toFixed(1) + '/' + csatTarget.toFixed(1) + ' 未達標，打 ' + (factor * 100).toFixed(0) + '%';
    } else {
      qualityNote = 'CSAT ' + csatActual.toFixed(1) + '/' + csatTarget.toFixed(1) + ' 達標';
    }
  } else {
    if (npsActual < npsTarget) {
      const factor = 1 - npsPenalty / 100;
      qualityAdjusted = behaviorAdjusted * factor;
      qualityNote = 'NPS ' + npsActual + '/' + npsTarget + ' 未達標，打 ' + (factor * 100).toFixed(0) + '%';
    } else {
      qualityNote = 'NPS ' + npsActual + '/' + npsTarget + ' 達標';
    }
  }

  // Clawback 多筆
  let totalClawback = 0;
  const clawbackDetails = [];
  if (clawbacks && clawbacks.length > 0) {
    for (const cb of clawbacks) {
      if (cb.totalMonths > 0 && cb.fulfilledMonths < cb.totalMonths) {
        const unfulfilledRatio = (cb.totalMonths - cb.fulfilledMonths) / cb.totalMonths;
        const originalComm = cb.amount * cb.rate / 100;
        const cbAmt = originalComm * unfulfilledRatio;
        totalClawback += cbAmt;
        clawbackDetails.push({ ...cb, clawbackAmt: cbAmt, unfulfilledRatio });
      }
    }
  }

  const finalBonus = Math.max(qualityAdjusted - totalClawback, 0);
  const totalPay = baseSalary + finalBonus;
  const totalPayMonthly = totalPay / 12;

  const laborRate = grossProfit > 0 ? (tco / grossProfit) * 100 : 0;
  const compaRatio = ote > 0 ? totalPay / ote : 0;
  const sweetGap = sweetSpot > 0 ? ((actual - sweetSpot) / sweetSpot * 100) : 0;

  let marginalRate = 0;
  if (actual > sweetSpot && sweetSpot > 0) {
    marginalRate = decelRate;
  } else if (steps.length > 0) {
    const lastT = steps[steps.length - 1].threshold;
    if (actual > lastT) marginalRate = lastStepRate * 100;
    else {
      let p = 0;
      for (const s of steps) {
        if (actual <= s.threshold) { marginalRate = s.rate; break; }
        p = s.threshold;
      }
    }
  }

  return {
    ote, tco, achieveRate, grossProfit, gmCommission,
    rawCommission, cappedCommission, capHit, capDeduction,
    tiers,
    retroactiveAddition,
    kpiAdjusted, behaviorAdjusted, qualityAdjusted, qualityNote,
    totalClawback, clawbackDetails,
    finalBonus, totalPay, totalPayMonthly,
    laborRate, compaRatio,
    sweetBonus, sweetGap, marginalRate,
    salary: baseSalary, targetBonus, quota, actual, sweetSpot, bonusCap
  };
}

function calcSweetSpotBonus(actual, sweetSpot, steps, lastStepRate) {
  let rem = Math.min(actual, sweetSpot);
  let bonus = 0;
  let pt = 0;
  for (const step of steps) {
    const ba = Math.max(0, Math.min(rem, step.threshold - pt));
    if (ba <= 0) { pt = step.threshold; continue; }
    bonus += ba * step.rate / 100;
    rem -= ba;
    pt = step.threshold;
  }
  if (rem > 0) bonus += rem * lastStepRate;
  return bonus;
}

function emptyResult(baseSalary, targetBonus, overheadRate, ote, tco, achieveRate, grossProfit, gmCommission, actual, quota, sweetSpot) {
  return {
    ote, tco, achieveRate, grossProfit, gmCommission,
    rawCommission: 0, cappedCommission: 0, capHit: false, capDeduction: 0,
    tiers: [],
    retroactiveAddition: 0,
    kpiAdjusted: 0, behaviorAdjusted: 0, qualityAdjusted: 0, qualityNote: '未達最低門檻',
    totalClawback: 0, clawbackDetails: [],
    finalBonus: 0, totalPay: baseSalary, totalPayMonthly: baseSalary / 12,
    laborRate: grossProfit > 0 ? (tco / grossProfit) * 100 : 0,
    compaRatio: ote > 0 ? baseSalary / ote : 0,
    sweetBonus: 0, sweetGap: sweetSpot > 0 ? ((actual - sweetSpot) / sweetSpot * 100) : 0,
    marginalRate: 0,
    salary: baseSalary, targetBonus, quota, actual, sweetSpot, bonusCap: 0
  };
}
