// 宿泊系プラン（BBQ＋宿泊貸切・飲み会＋宿泊貸切・4名部屋のみ利用・簡易部屋のみ利用）で共通して使う
// 「宿泊者名簿」関連のロジック。旅館業法対応のため、これらのプランでは人数を
// 男性・女性・子供の内訳で受け取り、住所も収集する。

const STAY_TIME_TYPES = ["stay_11_11", "stay_18_11", "stay_16_11"];

function isStayPlan(plan) {
  return !!plan && STAY_TIME_TYPES.includes(plan.time_type);
}

/**
 * リクエストボディの guestMale / guestFemale / guestChildren から、
 * 検証済みの人数内訳と合計人数を算出する。
 * 宿泊系プランでない場合は、従来通り単一の guestCount をそのまま使う。
 */
function resolveGuestBreakdown(plan, body) {
  if (!isStayPlan(plan)) {
    return { guestCount: Number(body.guestCount) || 0, guestMale: null, guestFemale: null, guestChildren: null, childrenCount: 0 };
  }
  const guestMale = Math.max(0, Math.round(Number(body.guestMale) || 0));
  const guestFemale = Math.max(0, Math.round(Number(body.guestFemale) || 0));
  const guestChildren = Math.max(0, Math.round(Number(body.guestChildren) || 0));
  const guestCount = guestMale + guestFemale + guestChildren;
  return { guestCount, guestMale, guestFemale, guestChildren, childrenCount: guestChildren };
}

module.exports = { STAY_TIME_TYPES, isStayPlan, resolveGuestBreakdown };
