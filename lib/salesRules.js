const { dayTypeOf } = require("./pricing");

/**
 * プランと日付から、その日の確定方式／販売可否を決定する。
 * confirmationRules は [{ day_type: 'weekday'|'weekend_holiday'|'all', confirmation_type: 'auto'|'manual'|'inquiry_only' }] の配列。
 * 具体的な曜日タイプのルールがあればそれを優先し、なければ 'all' ルール、それも無ければ 'manual' を既定値とする。
 * priceRules はあらかじめ await load() 済みの data.priceRules を渡す（祝日判定に使用）。
 */
function getConfirmationMode(plan, dateStr, priceRules) {
  const dayType = dayTypeOf(dateStr, priceRules);
  const rules = plan.confirmationRules || plan.confirmation_rules || [];

  const specific = rules.find((r) => r.day_type === dayType);
  if (specific) return specific.confirmation_type;

  const allRule = rules.find((r) => r.day_type === "all");
  if (allRule) return allRule.confirmation_type;

  return "manual";
}

const INQUIRY_ONLY_MESSAGE =
  "この日程はオンライン予約を受け付けておりません。恐れ入りますが、お電話またはメールでお問い合わせください。";

module.exports = { getConfirmationMode, INQUIRY_ONLY_MESSAGE };
