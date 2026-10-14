// 空き状況・料金のプレビュー計算（お客様用 /api/availability と管理画面用 /api/admin/availability で共有）。
// skipRestrictions=true（管理画面）の場合は、オンライン受付限定の制限
// （問い合わせ専用日・最終受付期限）を適用しない。人数・時刻・日程の重複チェックは常に行う。

const { load } = require("./store");
const { getPlan } = require("./plans");
const { resolveDatetime } = require("./timeTemplates");
const { hasConflict } = require("./availability");
const { calcPrice, selectOptions } = require("./pricing");
const { getConfirmationMode, INQUIRY_ONLY_MESSAGE } = require("./salesRules");
const { validateFlexibleStart } = require("./businessHours");
const { todayStr, daysBetween } = require("./dateUtil");
const { resolveGuestBreakdown } = require("./lodging");

const HARD_CONFLICT_MESSAGE = "この日程はすでに他のご予約で埋まっているため、オンラインでのご予約ができません。別日程をご検討ください。";
const ADJUSTABLE_CONFLICT_MESSAGE =
  "この日程はカフェ・飲食利用のご予約が入っておりますが、日程調整のご相談を承れる可能性がございます。お電話またはお問い合わせフォームよりご相談ください。";
const ADMIN_HARD_CONFLICT_MESSAGE = "この日程はすでに他の予約で埋まっています。";
const ADMIN_ADJUSTABLE_CONFLICT_MESSAGE = "この日程にはカフェ・飲食利用の予約が入っています。";

// 戻り値: { status, body }
async function checkAvailability(input, { skipRestrictions = false } = {}) {
  const { planId, date, slotId, startTime, nights, optionIds, optionQuantities } = input;

  const plan = await getPlan(planId);
  if (!plan) return { status: 404, body: { error: "plan_not_found" } };
  if (!date) return { status: 400, body: { error: "date_required" } };

  const { guestCount, childrenCount } = resolveGuestBreakdown(plan, input);

  const data = await load();

  if (!skipRestrictions) {
    if (getConfirmationMode(plan, date, data.priceRules) === "inquiry_only") {
      return { status: 200, body: { available: false, reason: INQUIRY_ONLY_MESSAGE, inquiryOnly: true } };
    }

    if (plan.final_booking_deadline_days_before !== null && plan.final_booking_deadline_days_before !== undefined) {
      const daysUntil = daysBetween(todayStr(), date);
      if (daysUntil < plan.final_booking_deadline_days_before) {
        return {
          status: 200,
          body: {
            available: false,
            reason: `このプランのオンライン受付は利用日の${plan.final_booking_deadline_days_before}日前までです。お電話にてご相談ください。`,
          },
        };
      }
    }
  }

  if (guestCount) {
    if (plan.min_guests && guestCount < plan.min_guests) {
      return { status: 200, body: { available: false, reason: `このプランは最少${plan.min_guests}名からです。` } };
    }
    if (plan.max_guests && guestCount > plan.max_guests) {
      return { status: 200, body: { available: false, reason: `このプランは最大${plan.max_guests}名までです。` } };
    }
  }

  if (plan.time_type === "flexible") {
    const timeError = validateFlexibleStart(startTime);
    if (timeError) return { status: 200, body: { available: false, reason: timeError } };
  }

  const { start, end, nightDates } = resolveDatetime({
    timeType: plan.time_type,
    date,
    slotId,
    startTime,
    nights,
    planId: plan.id,
  });

  const resourceIds = plan.resources.map((r) => r.id);
  const { conflict, adjustable } = await hasConflict({
    resourceIds,
    startDatetime: start,
    endDatetime: end,
    exclusivity: plan.exclusivity,
  });

  const selectedOptions = selectOptions(plan.options, optionIds || [], optionQuantities || {});
  const price = calcPrice({
    plan,
    nightDates,
    guestCount: guestCount || plan.min_guests || 1,
    selectedOptions,
    slotId,
    optionQuantities: optionQuantities || {},
    priceRules: data.priceRules,
    childrenCount,
  });

  const conflictMessage = adjustable
    ? skipRestrictions
      ? ADMIN_ADJUSTABLE_CONFLICT_MESSAGE
      : ADJUSTABLE_CONFLICT_MESSAGE
    : skipRestrictions
    ? ADMIN_HARD_CONFLICT_MESSAGE
    : HARD_CONFLICT_MESSAGE;

  return {
    status: 200,
    body: {
      available: !conflict,
      reason: conflict ? conflictMessage : null,
      conflictType: conflict ? (adjustable ? "adjustable" : "hard") : null,
      start,
      end,
      price,
    },
  };
}

module.exports = { checkAvailability };
