import { NextResponse } from "next/server";
const { load } = require("../../../lib/store");
const { getPlan } = require("../../../lib/plans");
const { resolveDatetime } = require("../../../lib/timeTemplates");
const { hasConflict } = require("../../../lib/availability");
const { calcPrice, selectOptions } = require("../../../lib/pricing");
const { getConfirmationMode, INQUIRY_ONLY_MESSAGE } = require("../../../lib/salesRules");
const { validateFlexibleTime } = require("../../../lib/businessHours");
const { todayStr, daysBetween } = require("../../../lib/dateUtil");

export const dynamic = "force-dynamic";

const HARD_CONFLICT_MESSAGE = "この日程はすでに他のご予約で埋まっているため、オンラインでのご予約ができません。別日程をご検討ください。";
const ADJUSTABLE_CONFLICT_MESSAGE =
  "この日程はカフェ・飲食利用のご予約が入っておりますが、日程調整のご相談を承れる可能性がございます。お電話またはお問い合わせフォームよりご相談ください。";

export async function POST(request) {
  const body = await request.json();
  const { planId, date, slotId, startTime, endTime, guestCount, optionIds, optionQuantities } = body;

  const plan = await getPlan(planId);
  if (!plan) return NextResponse.json({ error: "plan_not_found" }, { status: 404 });
  if (!date) return NextResponse.json({ error: "date_required" }, { status: 400 });

  const data = await load();

  if (getConfirmationMode(plan, date, data.priceRules) === "inquiry_only") {
    return NextResponse.json({ available: false, reason: INQUIRY_ONLY_MESSAGE, inquiryOnly: true });
  }

  if (plan.final_booking_deadline_days_before !== null && plan.final_booking_deadline_days_before !== undefined) {
    const daysUntil = daysBetween(todayStr(), date);
    if (daysUntil < plan.final_booking_deadline_days_before) {
      return NextResponse.json({
        available: false,
        reason: `このプランのオンライン受付は利用日の${plan.final_booking_deadline_days_before}日前までです。お電話にてご相談ください。`,
      });
    }
  }

  if (guestCount) {
    if (plan.min_guests && guestCount < plan.min_guests) {
      return NextResponse.json({ available: false, reason: `このプランは最少${plan.min_guests}名からです。` });
    }
    if (plan.max_guests && guestCount > plan.max_guests) {
      return NextResponse.json({ available: false, reason: `このプランは最大${plan.max_guests}名までです。` });
    }
  }

  if (plan.time_type === "flexible") {
    const timeError = validateFlexibleTime(startTime, endTime);
    if (timeError) return NextResponse.json({ available: false, reason: timeError });
  }

  const { start, end, nightDates } = resolveDatetime({
    timeType: plan.time_type,
    date,
    slotId,
    startTime,
    endTime,
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
  });

  return NextResponse.json({
    available: !conflict,
    reason: conflict ? (adjustable ? ADJUSTABLE_CONFLICT_MESSAGE : HARD_CONFLICT_MESSAGE) : null,
    conflictType: conflict ? (adjustable ? "adjustable" : "hard") : null,
    start,
    end,
    price,
  });
}
