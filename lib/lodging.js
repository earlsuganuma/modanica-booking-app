// 宿泊系プラン（BBQ＋宿泊貸切・飲み会＋宿泊貸切・4名部屋のみ利用・簡易部屋のみ利用）で共通して使う
// 「宿泊者名簿」関連のロジック。旅館業法対応のため、これらのプランでは人数を
// 男性・女性・子供の内訳で受け取り、住所も収集する。

const STAY_TIME_TYPES = ["stay_11_11", "stay_18_11", "stay_16_11"];

// 女性限定プラン等、男性人数の入力欄を出さない（常に0とする）プランのID。
// 例：女子会貸切宿泊プラン(p10)。
const NO_MALE_GUESTS_PLAN_IDS = ["p10"];

function isStayPlan(plan) {
  return !!plan && STAY_TIME_TYPES.includes(plan.time_type);
}

function includesMaleGuests(plan) {
  return !!plan && !NO_MALE_GUESTS_PLAN_IDS.includes(plan.id);
}

/**
 * リクエストボディの guestMale / guestFemale / guestChildren から、
 * 検証済みの人数内訳と合計人数を算出する。
 * 宿泊系プランでない場合は、従来通り単一の guestCount をそのまま使う。
 * 男性人数を収集しないプラン（女性限定プラン等）では guestMale は常に0。
 */
function resolveGuestBreakdown(plan, body) {
  if (!isStayPlan(plan)) {
    return { guestCount: Number(body.guestCount) || 0, guestMale: null, guestFemale: null, guestChildren: null, childrenCount: 0 };
  }
  const guestMale = includesMaleGuests(plan) ? Math.max(0, Math.round(Number(body.guestMale) || 0)) : 0;
  const guestFemale = Math.max(0, Math.round(Number(body.guestFemale) || 0));
  const guestChildren = Math.max(0, Math.round(Number(body.guestChildren) || 0));
  const guestCount = guestMale + guestFemale + guestChildren;
  return { guestCount, guestMale, guestFemale, guestChildren, childrenCount: guestChildren };
}

module.exports = { STAY_TIME_TYPES, isStayPlan, includesMaleGuests, resolveGuestBreakdown };
