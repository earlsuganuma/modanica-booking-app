import { NextResponse } from "next/server";
const { load, save } = require("../../../../../lib/store");
const { sendMail } = require("../../../../../lib/mailer");
const { reservationConfirmed, reservationCancelled } = require("../../../../../lib/emailTemplates");
const { computeAtRisk } = require("../../../../../lib/priorityRisk");
const { buildRepeatCounter } = require("../../../../../lib/repeater");
const payjpGateway = require("../../../../../lib/paymentGateway");
const { getConfirmedNote } = require("../../../../../lib/planMailNotes");
const { isStayPlan, includesMaleGuests } = require("../../../../../lib/lodging");
const { getPlan } = require("../../../../../lib/plans");
const { refundAmount: calcRefundAmount } = require("../../../../../lib/cancellationPolicy");

export const dynamic = "force-dynamic";

// 管理画面専用：予約詳細の取得とステータス変更（/api/admin/* はmiddleware.jsによりログイン必須）。

export async function GET(request, { params }) {
  const { id: idParam } = await params;
  const data = await load();
  const id = Number(idParam);
  const r = data.reservations.find((x) => x.id === id);
  if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const plan = data.plans.find((p) => p.id === r.planId);

  const options = (r.optionIds || []).map((oid) => {
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
  });

  // まだキャンセルしていない場合に、「今キャンセルしたら」の見込み返金額を管理者向けに提示する。
  const estimatedRefundIfCancelledNow =
    r.status !== "cancelled" && r.paymentStatus === "captured"
      ? calcRefundAmount(r.totalPrice, r.startDatetime)
      : null;

  return NextResponse.json({
    reservation: {
      id: r.id,
      plan_id: r.planId,
      plan_name: plan ? plan.name : r.planId,
      plan_category: plan ? plan.category : null,
      is_stay_plan: plan ? isStayPlan({ time_type: plan.timeType }) : false,
      shows_male_guests: plan ? includesMaleGuests(plan) : true,
      resource_ids: r.resourceIds,
      options,
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
      repeat_count: buildRepeatCounter(data.reservations)(r),
      note: r.note,
      status: r.status,
      total_price: r.totalPrice,
      created_at: r.createdAt,
      at_risk: r.status !== "cancelled" ? computeAtRisk(data, r) : false,
      payment_status: r.paymentStatus || "none",
      payment_amount: r.paymentAmount,
      refunded_amount: r.refundedAmount || 0,
      card_brand: r.cardBrand,
      card_last4: r.cardLast4,
      estimated_refund_if_cancelled_now: estimatedRefundIfCancelledNow,
    },
  });
}

export async function PATCH(request, { params }) {
  const { id: idParam } = await params;
  const body = await request.json();

  // 予約内容の編集（お客様情報・備考・宿泊者の内訳）。日程・人数・オプション・金額は変更しない。
  if (body.edit) {
    const data = await load();
    const r = data.reservations.find((x) => x.id === Number(idParam));
    if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const e = body.edit;
    const clean = (v) => String(v == null ? "" : v).trim();

    const name = clean(e.customerName);
    if (!name) return NextResponse.json({ error: "name_required", message: "お客様のお名前を入力してください。" }, { status: 400 });
    const email = clean(e.customerEmail);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "invalid_email", message: "メールアドレスの形式が正しくありません。" }, { status: 400 });
    }
    const plan = await getPlan(r.planId); // 宿泊プラン判定（time_type）にはリレーション付きのプランを使う
    const address = clean(e.customerAddress);
    if (plan && isStayPlan(plan) && !address) {
      return NextResponse.json({ error: "address_required", message: "宿泊プランのため、ご住所は必須です（宿泊者名簿）。" }, { status: 400 });
    }
    const note = clean(e.note);
    if (note.length > 2000) {
      return NextResponse.json({ error: "too_long", message: "備考は2000文字までです。" }, { status: 400 });
    }

    // 宿泊者の内訳（宿泊プランのみ）：合計は予約の人数と一致している必要がある。
    if (plan && isStayPlan(plan) && e.guestFemale !== undefined) {
      const male = includesMaleGuests(plan) ? Math.max(0, Math.floor(Number(e.guestMale) || 0)) : 0;
      const female = Math.max(0, Math.floor(Number(e.guestFemale) || 0));
      const children = Math.max(0, Math.floor(Number(e.guestChildren) || 0));
      if (male + female + children !== r.guestCount) {
        return NextResponse.json(
          { error: "breakdown_mismatch", message: `内訳の合計が人数（${r.guestCount}名）と一致しません。人数そのものは変更できません。` },
          { status: 400 }
        );
      }
      r.guestMale = male;
      r.guestFemale = female;
      r.guestChildren = children;
    }

    r.customerName = name;
    r.customerEmail = email || null;
    r.customerTel = clean(e.customerTel) || null;
    r.customerAddress = address || null;
    r.note = note || null;
    await save(data);
    return NextResponse.json({ ok: true });
  }

  const { status, fullRefund } = body;
  if (!["confirmed", "cancelled", "pending_review"].includes(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  const data = await load();
  const id = Number(idParam);
  const r = data.reservations.find((x) => x.id === id);
  if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const previousStatus = r.status;

  // 決済のある予約は、キャンセル後に「確定」「要確認」へ戻せない（返金済みなのに枠だけ埋まる事故の防止）。
  if (previousStatus === "cancelled" && status !== "cancelled" && r.paymentStatus && r.paymentStatus !== "none") {
    return NextResponse.json(
      { error: "cannot_reopen", message: "決済のある予約は、キャンセル後に元へ戻せません。新しく予約を作成してください。" },
      { status: 409 }
    );
  }

  // ステータスが実際に変わる場合のみ、決済（PAY.JP）の処理を行う。
  if (status !== previousStatus) {
    if (status === "confirmed" && r.paymentStatus === "authorized") {
      // 確定＝支払い確定（オーソリの与信枠を実際に請求する）。
      try {
        const capturedAmount = await payjpGateway.capture(r.payjpChargeId);
        r.paymentStatus = "captured";
        r.paymentAmount = capturedAmount;
      } catch (e) {
        const message = payjpGateway.errorMessage(
          e,
          "決済の確定処理に失敗しました。与信の期限切れ、またはカードの利用制限の可能性があります。PAY.JPの管理画面もあわせてご確認ください。"
        );
        return NextResponse.json({ error: "capture_failed", message }, { status: 402 });
      }
    } else if (status === "cancelled") {
      if (r.paymentStatus === "authorized") {
        // まだ確定（請求）していない：与信枠を解放するだけで、実際の請求は発生しない。
        try {
          await payjpGateway.releaseAuthorization(r.payjpChargeId);
          r.paymentStatus = "released";
        } catch (e) {
          const message = payjpGateway.errorMessage(e, "与信枠の解放に失敗しました。PAY.JPの管理画面をご確認ください。");
          return NextResponse.json({ error: "refund_failed", message }, { status: 402 });
        }
      } else if (r.paymentStatus === "captured") {
        // すでに確定（請求）済み：全額返金（当店都合）か、キャンセルポリシーに基づく自動計算の返金かを行う。
        const remaining = (r.paymentAmount || 0) - (r.refundedAmount || 0);
        const amountToRefund = fullRefund
          ? remaining
          : Math.min(remaining, calcRefundAmount(r.totalPrice, r.startDatetime));
        if (amountToRefund > 0) {
          try {
            await payjpGateway.refund(r.payjpChargeId, amountToRefund);
            r.refundedAmount = (r.refundedAmount || 0) + amountToRefund;
            r.paymentStatus = r.refundedAmount >= (r.paymentAmount || 0) ? "refunded" : "partially_refunded";
          } catch (e) {
            if (e && e.payjpError && e.payjpError.code === "already_refunded") {
              // PAY.JPの管理画面で先に全額返金されていた場合：こちらの記録を合わせてキャンセルを進める。
              r.refundedAmount = r.paymentAmount || r.refundedAmount || 0;
              r.paymentStatus = "refunded";
            } else {
              const message = payjpGateway.errorMessage(e, "返金処理に失敗しました。PAY.JPの管理画面をご確認ください。");
              return NextResponse.json({ error: "refund_failed", message }, { status: 402 });
            }
          }
        }
        // amountToRefund が 0（当日キャンセル等でキャンセル料が全額のケース）の場合は返金なし・paymentStatusは captured のまま。
      }
    }
    r.status = status;
    await save(data);
  }

  // ステータスが実際に変わったときだけメール送信する（同じ操作の連打で二重送信しないように）
  // メールアドレスのない予約（電話予約など）にはメールを送らない。
  if (status !== previousStatus && r.customerEmail) {
    const plan = data.plans.find((p) => p.id === r.planId);
    if (status === "confirmed") {
      const extraNote = await getConfirmedNote(r.planId);
      const mail = reservationConfirmed(r, plan, extraNote, data.options);
      await sendMail({ type: "reservation_confirmed", to: r.customerEmail, ...mail });
    } else if (status === "cancelled") {
      const mail = reservationCancelled(r, plan, { refundedAmount: r.refundedAmount || 0 }, data.options);
      await sendMail({ type: "reservation_cancelled", to: r.customerEmail, ...mail });
    }
  }

  return NextResponse.json({ ok: true, payment_status: r.paymentStatus, refunded_amount: r.refundedAmount || 0 });
}
