import { NextResponse } from "next/server";
const { load } = require("../../../../../lib/store");
const { getPlan } = require("../../../../../lib/plans");
const { resolveDatetime } = require("../../../../../lib/timeTemplates");
const { hasConflict } = require("../../../../../lib/availability");
const { calcPrice, selectOptions } = require("../../../../../lib/pricing");
const { getConfirmationMode, INQUIRY_ONLY_MESSAGE } = require("../../../../../lib/salesRules");
const { validateFlexibleStart } = require("../../../../../lib/businessHours");
const { todayStr, daysBetween } = require("../../../../../lib/dateUtil");
const { checkRateLimit } = require("../../../../../lib/rateLimit");
const { resolveGuestBreakdown, isStayPlan } = require("../../../../../lib/lodging");
const payjpV2 = require("../../../../../lib/payjpV2Client");
const draftToken = require("../../../../../lib/draftToken");
const { requiresOnlinePayment } = require("../../../../../lib/paymentRules");
const { validateBookingDate } = require("../../../../../lib/bookingWindow");

export const dynamic = "force-dynamic";

// PAY.JP API v2：予約フォームの入力内容を検証し、サーバー側で料金を確定計算したうえで
// Payment Flow を作成する。まだ予約は作らない（予約作成は決済後の /api/payments/v2/complete）。
// フォームの内容は暗号化トークン（draftToken）にして返し、決済後の戻りURLで予約を完了させる。
export async function POST(request) {
  const body = await request.json();
  const {
    planId,
    date,
    slotId,
    startTime,
    nights,
    optionIds = [],
    optionQuantities = {},
    customerName,
    customerEmail,
    customerAddress,
    method,
  } = body;

  const rateLimitError = checkRateLimit(request, customerEmail);
  if (rateLimitError) return rateLimitError;

  if (!payjpV2.isV2Enabled()) {
    return NextResponse.json(
      { error: "payment_not_configured", message: "現在オンライン決済がご利用いただけません。恐れ入りますがお電話にてご予約ください。" },
      { status: 503 }
    );
  }
  if (method !== "card" && method !== "paypay") {
    return NextResponse.json({ error: "invalid_method", message: "お支払い方法を選択してください。" }, { status: 400 });
  }

  const plan = await getPlan(planId);
  if (!plan) return NextResponse.json({ error: "plan_not_found" }, { status: 404 });
  if (!customerName || !customerEmail) {
    return NextResponse.json({ error: "customer_info_required" }, { status: 400 });
  }
  if (isStayPlan(plan) && !customerAddress) {
    return NextResponse.json({ error: "address_required", message: "宿泊者名簿の記載のため、ご住所の入力をお願いします。" }, { status: 400 });
  }

  const { guestCount, childrenCount } = resolveGuestBreakdown(plan, body);

  const windowError = validateBookingDate(date);
  if (windowError) return NextResponse.json({ error: "out_of_booking_window", message: windowError }, { status: 400 });

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
    const timeError = validateFlexibleStart(startTime);
    if (timeError) return NextResponse.json({ error: "invalid_time", message: timeError }, { status: 400 });
  }

  const { start, end, nightDates } = resolveDatetime({ timeType: plan.time_type, date, slotId, startTime, nights, planId: plan.id });
  const resourceIds = plan.resources.map((r) => r.id);

  const { conflict, adjustable } = await hasConflict({
    resourceIds,
    startDatetime: start,
    endDatetime: end,
    exclusivity: plan.exclusivity,
    planId: plan.id,
  });
  if (conflict) {
    const message = adjustable
      ? "この日程はカフェ・飲食利用のご予約が入っております。日程調整のご相談を承れる可能性がございますので、お電話またはお問い合わせフォームよりご連絡ください。"
      : "この日程はすでに他のご予約で埋まっているため、オンラインでのご予約ができません。";
    return NextResponse.json({ error: "conflict", message, conflictType: adjustable ? "adjustable" : "hard" }, { status: 409 });
  }

  const selectedOptions = selectOptions(plan.options, optionIds, optionQuantities);
  const price = calcPrice({ plan, nightDates, guestCount, selectedOptions, slotId, optionQuantities, priceRules: data.priceRules, childrenCount });

  if (price.total <= 0 || !requiresOnlinePayment(plan)) {
    return NextResponse.json({ error: "payment_not_required" }, { status: 400 });
  }

  try {
    const flow = await payjpV2.createPaymentFlow({
      amount: price.total,
      method,
      metadata: { planId: plan.id, date: String(date || ""), customerEmail: String(customerEmail || "").slice(0, 100) },
    });
    // 戻りURLで予約を完了させるための暗号化トークン（決済IDとフォーム内容を含む）。
    const token = draftToken.seal({ flowId: flow.id, method, draft: body });
    return NextResponse.json({
      paymentFlowId: flow.id,
      clientSecret: flow.client_secret,
      draftToken: token,
      price,
    });
  } catch (e) {
    const message = (e && e.payjpError && e.payjpError.message) || "お支払いの準備に失敗しました。時間をおいて再度お試しください。";
    return NextResponse.json({ error: "payment_create_failed", message }, { status: 502 });
  }
}
