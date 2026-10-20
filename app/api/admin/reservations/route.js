import { NextResponse } from "next/server";
const { load } = require("../../../../lib/store");
const { computeAtRisk } = require("../../../../lib/priorityRisk");
const { buildRepeatCounter } = require("../../../../lib/repeater");

const { save } = require("../../../../lib/store");
const { syncReservation } = require("../../../../lib/googleCalendar");
const { getPlan } = require("../../../../lib/plans");
const { resolveDatetime } = require("../../../../lib/timeTemplates");
const { hasConflict } = require("../../../../lib/availability");
const { calcPrice, selectOptions } = require("../../../../lib/pricing");
const { validateFlexibleStart } = require("../../../../lib/businessHours");
const { isStayPlan, resolveGuestBreakdown } = require("../../../../lib/lodging");

export const dynamic = "force-dynamic";

const PAYMENT_LABELS = {
  onsite: "現地払い",
  invoice: "請求書払い",
  bank_transfer: "事前銀行振込",
  other: "その他",
};

// 管理画面からの予約登録（電話予約など）。決済なし・確認メールなし。
// /api/admin/* はログイン必須（proxy.js）。
// お客様向けフォームとの違い：オンライン受付期限・問い合わせ専用日の制限は適用しない（管理者の判断で登録）。
// 日程の重複チェックと料金計算（サーバー側の確定計算）は同じものを使う。
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
    customerTel,
    customerAddress,
    note,
    paymentMethod = "onsite",
    status = "confirmed",
    totalPriceOverride,
  } = body;

  const plan = await getPlan(planId);
  if (!plan) return NextResponse.json({ error: "plan_not_found", message: "プランが見つかりません。" }, { status: 404 });
  if (!customerName) return NextResponse.json({ error: "customer_info_required", message: "お客様のお名前を入力してください。" }, { status: 400 });
  if (!date) return NextResponse.json({ error: "date_required", message: "日付を選択してください。" }, { status: 400 });
  if (!["confirmed", "pending_review"].includes(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  if (isStayPlan(plan) && !customerAddress) {
    return NextResponse.json({ error: "address_required", message: "宿泊者名簿の記載のため、ご住所を入力してください。" }, { status: 400 });
  }

  const { guestCount, guestMale, guestFemale, guestChildren, childrenCount } = resolveGuestBreakdown(plan, body);
  if (plan.min_guests && guestCount < plan.min_guests) {
    return NextResponse.json({ error: "guest_count_too_low", message: `このプランの最少人数は${plan.min_guests}名です。` }, { status: 400 });
  }
  if (plan.max_guests && guestCount > plan.max_guests) {
    return NextResponse.json({ error: "guest_count_too_high", message: `このプランの最大人数は${plan.max_guests}名です。` }, { status: 400 });
  }
  if (plan.time_type === "flexible") {
    const timeError = validateFlexibleStart(startTime);
    if (timeError) return NextResponse.json({ error: "invalid_time", message: timeError }, { status: 400 });
  }

  const data = await load();
  const { start, end, nightDates } = resolveDatetime({ timeType: plan.time_type, date, slotId, startTime, nights, planId: plan.id });
  const resourceIds = plan.resources.map((r) => r.id);

  const { conflict, adjustable } = await hasConflict({
    resourceIds,
    startDatetime: start,
    endDatetime: end,
    exclusivity: plan.exclusivity,
  });
  if (conflict) {
    const message = adjustable
      ? "この日程にはカフェ・飲食利用の予約が入っています。"
      : "この日程はすでに他の予約で埋まっています。";
    return NextResponse.json({ error: "conflict", message }, { status: 409 });
  }

  const selectedOptions = selectOptions(plan.options, optionIds, optionQuantities);
  const price = calcPrice({ plan, nightDates, guestCount, selectedOptions, slotId, optionQuantities, priceRules: data.priceRules, childrenCount });

  let totalPrice = price.total;
  if (totalPriceOverride !== undefined && totalPriceOverride !== null && totalPriceOverride !== "") {
    const v = Number(totalPriceOverride);
    if (!Number.isFinite(v) || v < 0) {
      return NextResponse.json({ error: "invalid_price", message: "金額の指定が正しくありません。" }, { status: 400 });
    }
    totalPrice = Math.floor(v);
  }

  // 支払い方法は専用の列を持たないため、備考の先頭に目印として記録する。
  const label = PAYMENT_LABELS[paymentMethod] || PAYMENT_LABELS.other;
  const noteText = `【電話・店頭受付／${label}】${note ? `\n${note}` : ""}`;

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
    guestMale,
    guestFemale,
    guestChildren,
    customerName,
    customerEmail: customerEmail || null,
    customerTel: customerTel || null,
    customerAddress: customerAddress || null,
    note: noteText,
    status,
    totalPrice,
    createdAt: new Date().toISOString(),
    paymentStatus: "none",
    payjpChargeId: null,
    paymentAmount: null,
    refundedAmount: 0,
    cardBrand: null,
    cardLast4: null,
  };
  data.reservations.push(reservation);
  data.nextReservationId = id + 1;
  await save(data);
  await syncReservation(reservation, plan, data.options);

  return NextResponse.json({ reservationId: id, price: { ...price, total: totalPrice }, status });
}

// 管理画面専用の予約一覧API（middleware.jsにより /api/admin/* はログイン必須）。
// 顧客氏名・連絡先などの個人情報を含むため、必ず認証済みのリクエストのみが通ること。
export async function GET() {
  const data = await load();
  const repeatCount = buildRepeatCounter(data.reservations);
  const reservations = [...data.reservations]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((r) => {
      const plan = data.plans.find((p) => p.id === r.planId);
      return {
        id: r.id,
        plan_id: r.planId,
        plan_name: plan ? plan.name : r.planId,
        plan_category: plan ? plan.category : null,
        resource_ids: r.resourceIds,
        option_ids: r.optionIds,
        option_quantities: r.optionQuantities || {},
        options: (r.optionIds || []).map((oid) => {
          const o = data.options.find((x) => x.id === oid);
          const qty = r.optionQuantities && r.optionQuantities[oid];
          return o
            ? {
                id: o.id,
                name: o.name,
                unit: o.unit || "flag",
                unitLabel: o.unitLabel || "個",
                quantity: o.unit === "quantity" ? qty : null,
              }
            : { id: oid, name: oid, unit: "flag", unitLabel: "個", quantity: null };
        }),
        start_datetime: r.startDatetime,
        end_datetime: r.endDatetime,
        guest_count: r.guestCount,
        guest_male: r.guestMale,
        guest_female: r.guestFemale,
        guest_children: r.guestChildren,
        customer_name: r.customerName,
        customer_email: r.customerEmail,
        customer_tel: r.customerTel,
        customer_address: r.customerAddress,
        repeat_count: repeatCount(r),
        note: r.note,
        status: r.status,
        total_price: r.totalPrice,
        created_at: r.createdAt,
        at_risk: r.status !== "cancelled" ? computeAtRisk(data, r) : false,
      };
    });
  return NextResponse.json({ reservations });
}
