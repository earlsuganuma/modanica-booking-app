// オンライン決済が不要（当日店頭でのお支払い）のプラン。
// これらのプランは予約フローから決済（カード・PayPay）を外し、予約を直接作成する。
// ・p9：通常カフェ利用
const NO_ONLINE_PAYMENT_PLAN_IDS = ["p9"];

function requiresOnlinePayment(plan) {
  return !(plan && NO_ONLINE_PAYMENT_PLAN_IDS.includes(plan.id));
}

module.exports = { NO_ONLINE_PAYMENT_PLAN_IDS, requiresOnlinePayment };
