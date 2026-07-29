// 曜日タイプの基本係数。祝日・シーズンは price_rules（管理画面で編集可能）で上書きされる。
const WEEKEND_COEFFICIENT = 1.2;
const WEEKDAY_COEFFICIENT = 1.0;

// 注意：この関数群は同期的に保つため、DBアクセスは行わない。
// 呼び出し側が事前に await load() した data.priceRules を明示的に渡すこと
// （lib/priorityRisk.js の computeAtRisk(data, reservation) と同じ方針）。

function matchingRules(dateStr, priceRules) {
  return (priceRules || []).filter((r) => r.startDate <= dateStr && dateStr <= r.endDate);
}

function isHolidayDate(dateStr, priceRules) {
  return (priceRules || []).some((r) => r.type === "holiday" && r.startDate <= dateStr && dateStr <= r.endDate);
}

function dayTypeOf(dateStr, priceRules) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay(); // 0=Sun, 6=Sat
  const holiday = isHolidayDate(dateStr, priceRules);
  return day === 0 || day === 6 || holiday ? "weekend_holiday" : "weekday";
}

/**
 * 指定日の料金係数。price_rules（祝日・シーズン登録）に一致するものがあれば
 * その中で最大の係数を採用し、なければ曜日タイプ（平日1.0/週末祝日1.2）にフォールバックする。
 */
function coefficientOf(dateStr, priceRules) {
  const rules = matchingRules(dateStr, priceRules);
  if (rules.length > 0) {
    return Math.max(...rules.map((r) => r.coefficient));
  }
  return dayTypeOf(dateStr, priceRules) === "weekend_holiday" ? WEEKEND_COEFFICIENT : WEEKDAY_COEFFICIENT;
}

function appliedRuleLabels(dateStr, priceRules) {
  return matchingRules(dateStr, priceRules).map((r) => r.label);
}

/**
 * @param {object} plan
 * @param {string[]} nightDates - 宿泊対象の日付（YYYY-MM-DD）の配列。日帰り系は当日1件のみ。
 * @param {number} guestCount
 * @param {Array<{id:string, price:number, unit?:string}>} selectedOptions
 * @param {string} [slotId] - time_type が slot3 のプランで、枠ごとに料金が異なる場合の選択枠ID
 * @param {Object<string, number>} [optionQuantities] - unit が "quantity" のオプションについて選択された個数
 * @param {Array} [priceRules] - あらかじめ await load() 済みの data.priceRules
 */
function calcPrice({ plan, nightDates, guestCount, selectedOptions, slotId, optionQuantities = {}, priceRules = [] }) {
  const perUnitPlans = new Set(["p6", "p7", "p8", "p9"]); // 1名あたり料金のプラン

  // slot3タイプで枠ごとの料金（slot_prices）が設定されている場合は、その枠の単価を基本料金として使う
  let unitPrice = plan.base_price;
  if (plan.time_type === "slot3" && plan.slot_prices && slotId && plan.slot_prices[slotId] != null) {
    unitPrice = plan.slot_prices[slotId];
  }

  let base = 0;

  if (perUnitPlans.has(plan.id)) {
    const coeff = coefficientOf(nightDates[0], priceRules);
    base = Math.round(unitPrice * coeff * guestCount);
  } else {
    for (const d of nightDates) {
      base += Math.round(unitPrice * coefficientOf(d, priceRules));
    }
  }

  // オプション料金：
  // - unit が "quantity" のオプションは、指定された個数をそのまま掛ける（人数連動はしない）
  // - それ以外（チェックのみ）は従来通り、1名あたり課金プランなら人数分、それ以外は1件分
  const optionBreakdown = selectedOptions.map((o) => {
    const quantity = o.unit === "quantity" ? Math.max(1, Number(optionQuantities[o.id]) || 1) : perUnitPlans.has(plan.id) ? guestCount : 1;
    return { id: o.id, name: o.name, unit: o.unit || "flag", unitLabel: o.unitLabel || "個", quantity, unitPrice: o.price, subtotal: o.price * quantity };
  });
  const optionsTotal = optionBreakdown.reduce((sum, o) => sum + o.subtotal, 0);

  return {
    base,
    optionsTotal,
    optionBreakdown,
    total: base + optionsTotal,
    dayTypes: nightDates.map((d) => dayTypeOf(d, priceRules)),
    appliedRules: nightDates.map((d) => appliedRuleLabels(d, priceRules)),
  };
}

/**
 * プランのオプション一覧から、実際に選択されているものを判定する。
 * - unit が "quantity" のオプションは optionQuantities[id] > 0 なら選択扱い
 * - それ以外（チェックのみ）は optionIds に含まれていれば選択扱い
 */
function selectOptions(planOptions, optionIds = [], optionQuantities = {}) {
  return (planOptions || []).filter((o) => {
    if (o.unit === "quantity") {
      return Number(optionQuantities[o.id]) > 0;
    }
    return optionIds.includes(o.id);
  });
}

module.exports = { dayTypeOf, coefficientOf, calcPrice, matchingRules, selectOptions };
