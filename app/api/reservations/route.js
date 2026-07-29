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
