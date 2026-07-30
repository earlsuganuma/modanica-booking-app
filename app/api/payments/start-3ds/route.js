import { NextResponse } from "next/server";
const { load } = require("../../../../lib/store");
const { getPlan } = require("../../../../lib/plans");
const { resolveDatetime } = require("../../../../lib/timeTemplates");
const { hasConflict } = require("../../../../lib/availability");
const { calcPrice, selectOptions } = require("../../../../lib/pricing");
const { getConfirmationMode, INQUIRY_ONLY_MESSAGE } = require("../../../../lib/salesRules");
const { validateFlexibleTime } = require("../../../../lib/businessHours");
const { todayStr, daysBetween } = require("../../../../lib/dateUtil");
const { checkRateLimit } = require("../../../../lib/rateLimit");
const payjpClient = require("../../../../lib/payjpClient");

export const dynamic = "force-dynamic";

// 予約フォーム送信の最初のステップ：カード情報のトークン化が済んだ段階で呼び出す。
// ここで料金をサーバー側で確定計算し、その金額で「支払い作成時の3Dセキュア」の
// 与信枠確保（capture:false, three_d_secure:true）を行う。
// この時点ではまだ実際の予約は作成されない（予約作成は /api/reservations が
// 発行済みのchargeIdを検証したうえで行う）。
export async function POST(request) {
  const body = await request.json();
  const { planId, date, slotId, startTime, endTime, guestCount, optionIds = [], optionQuantities = {}, customerEmail, payjpToken } = body;

  const rateLimitError = checkRateLimit(request, customerEmail);
  if (rateLimitError) return rateLimitError;

  if (!payjpClient.isConfigured()) {
    return NextResponse.json(
      { error: "payment_not_configured", message: "現在オンライン決済がご利用いただけません。恐れ入りますがお電話にてご予約ください。" },
      { status: 503 }
    );
  }
  if (!payjpToken) {
    return NextResponse.json({ error: "card_required", message: "お支払い情報（クレジットカード）を入力してください。" }, { status: 400 });
  }

  const plan = await getPlan(planId);
  if (!plan) return NextResponse.json({ error: "plan_not_found" }, { status: 404 });

  const data = await load();
  if (getConfirmationMode(plan, date, data.priceRules) === "inquiry_only") {
    return NextResponse.json({ error: "inquiry_only", message: INQUIRY_ONLY_MESSAGE }, { status: 409 });
  }
  if (plan.final_booking_deadline_days_before !== null && plan.final_booking_deadline_days_before !== undefined) {
    const daysUntil = daysBetween(todayStr(), date);
    if (daysUntil < plan.final_booking_deadline_days_before) {
      return NextResponse.json(
        {
          error: "deadline_passed",
          message: `このプランのオンライン受付は利用日の${plan.final_booking_deadline_days_before}日前までです。お電話にてご相談ください。`,
        },
        { status: 409 }
      );
    }
  }
  if (plan.min_guests && guestCount < plan.min_guests) {
    return NextResponse.json({ error: "guest_count_too_low" }, { status: 400 });
  }
  if (plan.max_guests && guestCount > plan.max_guests) {
    return NextResponse.json({ error: "guest_count_too_high" }, { status: 400 });
  }
  if (plan.time_type === "flexible") {
    const timeError = validateFlexibleTime(startTime, endTime);
    if (timeError) return NextResponse.json({ error: "invalid_time", message: timeError }, { status: 400 });
  }

  const { start, end, nightDates } = resolveDatetime({ timeType: plan.time_type, date, slotId, startTime, endTime });
  const resourceIds = plan.resources.map((r) => r.id);

  const { conflict, adjustable } = await hasConflict({
    resourceIds,
    startDatetime: start,
    endDatetime: end,
    exclusivity: plan.exclusivity,
  });
  if (conflict) {
    const message = adjustable
      ? "この日程はカフェ・飲食利用のご予約が入っております。日程調整のご相談を承れる可能性がございますので、お電話またはお問い合わせフォームよりご連絡ください。"
      : "この日程はすでに他のご予約で埋まっているため、オンラインでのご予約ができません。";
    return NextResponse.json({ error: "conflict", message, conflictType: adjustable ? "adjustable" : "hard" }, { status: 409 });
  }

  const selectedOptions = selectOptions(plan.options, optionIds, optionQuantities);
  const price = calcPrice({ plan, nightDates, guestCount, selectedOptions, slotId, optionQuantities, priceRules: data.priceRules });

  if (price.total <= 0) {
    return NextResponse.json({ error: "payment_not_required" }, { status: 400 });
  }

  try {
    const charge = await payjpClient.authorizeWithThreeDSecure({
      amount: price.total,
      token: payjpToken,
      metadata: { planId: plan.id, customerEmail: customerEmail || "" },
    });
    return NextResponse.json({ chargeId: charge.id, price });
  } catch (e) {
    const message = (e && e.payjpError && e.payjpError.message) || "クレジットカードの確認に失敗しました。カード情報をご確認のうえ再度お試しください。";
    return NextResponse.json({ error: "card_declined", message }, { status: 402 });
  }
}
