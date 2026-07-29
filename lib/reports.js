// 予約データからの売上集計。data は await load() 済みのオブジェクトを渡す（同期・純粋関数）。

/**
 * 指定した年月（1-12）の売上集計を作る。
 * 集計基準は「利用日（startDatetime）」。作成日ではない点に注意
 * （売上の実態を「その日に何があったか」で見たいため）。
 *
 * @param {object} data - await load() の結果
 * @param {number} year
 * @param {number} month - 1〜12
 */
function buildRevenueReport(data, year, month) {
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const inMonth = (data.reservations || []).filter((r) => (r.startDatetime || "").slice(0, 7) === monthPrefix);

  const totals = { confirmed: 0, pending_review: 0, cancelled: 0 };
  const byDayMap = {};
  const byPlanMap = {};

  for (const r of inMonth) {
    const day = r.startDatetime.slice(0, 10);
    totals[r.status] = (totals[r.status] || 0) + (r.totalPrice || 0);

    if (r.status === "cancelled") continue;

    if (!byDayMap[day]) byDayMap[day] = { date: day, confirmed: 0, pending_review: 0, count: 0 };
    byDayMap[day][r.status] += r.totalPrice || 0;
    byDayMap[day].count += 1;

    const plan = (data.plans || []).find((p) => p.id === r.planId);
    const planKey = r.planId;
    if (!byPlanMap[planKey]) {
      byPlanMap[planKey] = { planId: planKey, planName: plan ? plan.name : r.planId, confirmed: 0, pending_review: 0, count: 0 };
    }
    byPlanMap[planKey][r.status] += r.totalPrice || 0;
    byPlanMap[planKey].count += 1;
  }

  const byDay = Object.values(byDayMap).sort((a, b) => a.date.localeCompare(b.date));
  const byPlan = Object.values(byPlanMap).sort((a, b) => b.confirmed + b.pending_review - (a.confirmed + a.pending_review));

  return {
    year,
    month,
    totals,
    grandTotal: totals.confirmed + totals.pending_review,
    byDay,
    byPlan,
    reservationCount: inMonth.filter((r) => r.status !== "cancelled").length,
  };
}

module.exports = { buildRevenueReport };
