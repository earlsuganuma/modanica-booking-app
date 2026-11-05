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
// 来店済み・未来店は「確定」として集計する（確定後の来店記録のため、売上は確定のまま）。
const reportKey = (s) => (s === "visited" || s === "no_show" ? "confirmed" : s);

function buildRevenueReport(data, year, month, otaBlocks = []) {
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const inMonth = (data.reservations || []).filter((r) => (r.startDatetime || "").slice(0, 7) === monthPrefix);

  const totals = { confirmed: 0, pending_review: 0, cancelled: 0 };
  const byDayMap = {};
  const byPlanMap = {};

  for (const r of inMonth) {
    const day = r.startDatetime.slice(0, 10);
    totals[reportKey(r.status)] = (totals[reportKey(r.status)] || 0) + (r.totalPrice || 0);

    if (r.status === "cancelled") continue;

    if (!byDayMap[day]) byDayMap[day] = { date: day, confirmed: 0, pending_review: 0, count: 0 };
    byDayMap[day][reportKey(r.status)] += r.totalPrice || 0;
    byDayMap[day].count += 1;

    const plan = (data.plans || []).find((p) => p.id === r.planId);
    const planKey = r.planId;
    if (!byPlanMap[planKey]) {
      byPlanMap[planKey] = { planId: planKey, planName: plan ? plan.name : r.planId, confirmed: 0, pending_review: 0, count: 0 };
    }
    byPlanMap[planKey][reportKey(r.status)] += r.totalPrice || 0;
    byPlanMap[planKey].count += 1;
  }

  // OTA経由（Booking.com・Airbnb）：チェックイン日の月で集計し、金額は管理画面に入力した「宿泊料金」（宿泊税は含めない）。
  // OTAの予約は、すべて「確定」として扱う。コミッション（手数料）は差し引かない（OTAの総額ベース）。
  const bySourceMap = {
    own: { source: "own", label: "自社（サイト・電話・店頭）", confirmed: 0, pending_review: 0, count: 0 },
  };
  for (const r of inMonth) {
    if (r.status === "cancelled") continue;
    bySourceMap.own[reportKey(r.status)] += r.totalPrice || 0;
    bySourceMap.own.count += 1;
  }
  let otaUnpriced = 0;
  for (const b of otaBlocks) {
    if ((b.startDate || "").slice(0, 7) !== monthPrefix) continue;
    const price = Number(b.totalPrice) || 0;
    if (b.totalPrice == null) otaUnpriced += 1;
    const day = b.startDate;
    totals.confirmed += price;

    if (!byDayMap[day]) byDayMap[day] = { date: day, confirmed: 0, pending_review: 0, count: 0 };
    byDayMap[day].confirmed += price;
    byDayMap[day].count += 1;

    const planKey = `ota-${b.channel}-${b.resourceId}`;
    if (!byPlanMap[planKey]) {
      byPlanMap[planKey] = { planId: planKey, planName: `${b.channelLabel || b.channel}　${b.roomLabel || b.resourceId}`, confirmed: 0, pending_review: 0, count: 0 };
    }
    byPlanMap[planKey].confirmed += price;
    byPlanMap[planKey].count += 1;

    const sk = `ota-${b.channel}`;
    if (!bySourceMap[sk]) bySourceMap[sk] = { source: sk, label: b.channelLabel || b.channel, confirmed: 0, pending_review: 0, count: 0 };
    bySourceMap[sk].confirmed += price;
    bySourceMap[sk].count += 1;
  }
  const otaCount = otaBlocks.filter((b) => (b.startDate || "").slice(0, 7) === monthPrefix).length;

  const byDay = Object.values(byDayMap).sort((a, b) => a.date.localeCompare(b.date));
  const byPlan = Object.values(byPlanMap).sort((a, b) => b.confirmed + b.pending_review - (a.confirmed + a.pending_review));

  return {
    year,
    month,
    totals,
    grandTotal: totals.confirmed + totals.pending_review,
    byDay,
    byPlan,
    reservationCount: inMonth.filter((r) => r.status !== "cancelled").length + otaCount,
    bySource: Object.values(bySourceMap),
    otaUnpriced,
  };
}

module.exports = { buildRevenueReport };
