import { NextResponse } from "next/server";
const { load, save } = require("../../../lib/store");
const { getPlan } = require("../../../lib/plans");
const { resolveDatetime } = require("../../../lib/timeTemplates");
const { hasConflict } = require("../../../lib/availability");
const { calcPrice, selectOptions } = require("../../../lib/pricing");
const { getConfirmationMode, INQUIRY_ONLY_MESSAGE } = require("../../../lib/salesRules");
const { validateFlexibleTime } = require("../../../lib/businessHours");
const { todayStr, daysBetween } = require("../../../lib/dateUtil");
const { sendMail, ADMIN_NOTIFY_EMAIL } = require("../../../lib/mailer");
const { reservationReceived, adminNewReservationNotice } = require("../../../lib/emailTemplates");
const payjpClient = require("../../../lib/payjpClient");

export const dynamic = "force-dynamic";

// GETは廃止（予約一覧の閲覧は個人情報を含むため、ログイン必須の
// /api/admin/reservations に移行済み）。POST（新規予約作成）のみ公開する。
export async function GET() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

export async function POST(request) {
  const body = await request.json();
  const {
    planId,
    date,
    slotId,
    startTime,
    endTime,
    guestCount,
    optionIds = [],
    optionQuantities = {},
    customerName,
    customerEmail,
    customerTel,
    note,
    payjpToken,
  } = body;

  const plan = await getPlan(planId);
  if (!plan) return NextResponse.json({ error: "plan_not_found" }, { status: 404 });
  if (!customerName || !customerEmail) {
    return NextResponse.json({ error: "customer_info_required" }, { status: 400 });
  }
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
  console.error("DEBUG_RESERVE_DATETIME", JSON.stringify({ date, slotId, timeType: plan.time_type, start, end }));
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

  // 決済（PAY.JP）：この時点ではオーソリ（与信枠の確保）のみ行い、実際の請求は
  // 管理者が予約を「確定」に変更したタイミングで行う（lib/payjpClient.js 参照）。
  let paymentStatus = "none";
  let payjpChargeId = null;
  let paymentAmount = null;
  let cardBrand = null;
  let cardLast4 = null;

  if (price.total > 0) {
    if (!payjpClient.isConfigured()) {
      return NextResponse.json(
        { error: "payment_not_configured", message: "現在オンライン決済がご利用いただけません。恐れ入りますがお電話にてご予約ください。" },
        { status: 503 }
      );
    }
    if (!payjpToken) {
      return NextResponse.json({ error: "card_required", message: "お支払い情報（クレジットカード）を入力してください。" }, { status: 400 });
    }
    try {
      const charge = await payjpClient.authorize({
        amount: price.total,
        token: payjpToken,
        metadata: { planId: plan.id, customerEmail },
      });
      paymentStatus = "authorized";
      payjpChargeId = charge.id;
      paymentAmount = charge.amount;
      cardBrand = charge.card ? charge.card.brand : null;
      cardLast4 = charge.card ? charge.card.last4 : null;
    } catch (e) {
      const message =
        (e && e.response && e.response.body && e.response.body.error && e.response.body.error.message) ||
        "クレジットカードの決済処理に失敗しました。カード情報をご確認のうえ再度お試しください。";
      return NextResponse.json({ error: "card_declined", message }, { status: 402 });
    }
  }

  const id = data.nextReservationId || 1;
  const reservation = {
    id,
    planId: plan.id,
    resourceIds,
    optionIds: selectedOptions.map((o) => o.id),
    optionQuantities,
    startDatetime: start,
    endDatetime: end,
    guestCount,
    customerName,
    customerEmail,
    customerTel: customerTel || null,
    note: note || null,
    status: "pending_review", // 初期運用方針：全プラン要確認スタート
    totalPrice: price.total,
    createdAt: new Date().toISOString(),
    paymentStatus,
    payjpChargeId,
    paymentAmount,
    refundedAmount: 0,
    cardBrand,
    cardLast4,
  };
  data.reservations.push(reservation);
  data.nextReservationId = id + 1;
  await save(data);

  // 予約受付メール（お客様宛）＋ 新規予約通知（運営者宛・ADMIN_NOTIFY_EMAIL設定時のみ）
  const receivedMail = reservationReceived(reservation, plan);
  await sendMail({ type: "reservation_received", to: customerEmail, ...receivedMail });
  if (ADMIN_NOTIFY_EMAIL) {
    const adminMail = adminNewReservationNotice(reservation, plan);
    await sendMail({ type: "admin_notify", to: ADMIN_NOTIFY_EMAIL, ...adminMail });
  }

  return NextResponse.json({ reservationId: id, price, status: "pending_review" });
}
