const { todayStr, daysBetween } = require("./dateUtil");

// このプラン（宿泊・施設貸切など）がまだオンライン予約可能かどうか
// = 最終受付期限（finalBookingDeadlineDaysBefore）を過ぎていないか
function isPlanStillBookable(plan, daysUntil) {
  const deadline = plan.finalBookingDeadlineDaysBefore ?? 0;
  return daysUntil >= deadline;
}

/**
 * partial（カフェ・部分利用）予約について、同じ資源を使う優先度の高いプラン
 * （宿泊貸切・部屋貸切・BBQエリア貸切等、exclusivity !== 'partial'）が
 * まだ受付期間内で、今後ぶつかる可能性が残っているかどうかを判定する。
 * true の場合は「仮予約（宿泊等の優先予約が入る可能性あり）」として管理画面に表示する。
 */
function computeAtRisk(data, reservation) {
  const plan = data.plans.find((p) => p.id === reservation.planId);
  if (!plan || plan.exclusivity !== "partial") return false;

  const dateStr = reservation.startDatetime.split("T")[0];
  const daysUntil = daysBetween(todayStr(), dateStr);
  if (daysUntil < 0) return false; // 過去日はリスクなし

  const competingPlans = data.plans.filter((p) => {
    if (p.id === plan.id) return false;
    if (p.exclusivity === "partial") return false;
    return data.planResources.some(
      (pr) => pr.planId === p.id && reservation.resourceIds.includes(pr.resourceId)
    );
  });

  return competingPlans.some((p) => isPlanStillBookable(p, daysUntil));
}

module.exports = { computeAtRisk, isPlanStillBookable };
