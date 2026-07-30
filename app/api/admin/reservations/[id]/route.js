import { NextResponse } from "next/server";
const { load, save } = require("../../../../../lib/store");
const { sendMail } = require("../../../../../lib/mailer");
const { reservationConfirmed, reservationCancelled } = require("../../../../../lib/emailTemplates");
const { computeAtRisk } = require("../../../../../lib/priorityRisk");
const payjpClient = require("../../../../../lib/payjpClient");
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
      resource_ids: r.resourceIds,
      options,
      start_datetime: r.startDatetime,
      end_datetime: r.endDatetime,
      guest_count: r.guestCount,
      customer_name: r.customerName,
      customer_email: r.customerEmail,
      customer_tel: r.customerTel,
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
  const { status, fullRefund } = body;
  if (!["confirmed", "cancelled", "pending_review"].includes(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  const data = await load();
  const id = Number(idParam);
  const r = data.reservations.find((x) => x.id === id);
  if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const previousStatus = r.status;

  // ステータスが実際に変わる場合のみ、決済（PAY.JP）の処理を行う。
  if (status !== previousStatus) {
    if (status === "confirmed" && r.paymentStatus === "authorized") {
      // 確定＝支払い確定（オーソリの与信枠を実際に請求する）。
      try {
        const charge = await payjpClient.capture(r.payjpChargeId);
        r.paymentStatus = "captured";
        r.paymentAmount = charge.amount;
      } catch (e) {
        const message =
          (e && e.response && e.response.body && e.response.body.error && e.response.body.error.message) ||
          "決済の確定処理に失敗しました。与信の期限切れ、またはカードの利用制限の可能性があります。PAY.JPの管理画面もあわせてご確認ください。";
        return NextResponse.json({ error: "capture_failed", message }, { status: 402 });
      }
    } else if (status === "cancelled") {
      if (r.paymentStatus === "authorized") {
        // まだ確定（請求）していない：与信枠を解放するだけで、実際の請求は発生しない。
        try {
          await payjpClient.refund(r.payjpChargeId);
          r.paymentStatus = "released";
        } catch (e) {
          const message =
            (e && e.response && e.response.body && e.response.body.error && e.response.body.error.message) ||
            "与信枠の解放に失敗しました。PAY.JPの管理画面をご確認ください。";
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
            await payjpClient.refund(r.payjpChargeId, amountToRefund);
            r.refundedAmount = (r.refundedAmount || 0) + amountToRefund;
            r.paymentStatus = r.refundedAmount >= (r.paymentAmount || 0) ? "refunded" : "partially_refunded";
          } catch (e) {
            const message =
              (e && e.response && e.response.body && e.response.body.error && e.response.body.error.message) ||
              "返金処理に失敗しました。PAY.JPの管理画面をご確認ください。";
            return NextResponse.json({ error: "refund_failed", message }, { status: 402 });
          }
        }
        // amountToRefund が 0（当日キャンセル等でキャンセル料が全額のケース）の場合は返金なし・paymentStatusは captured のまま。
      }
    }
    r.status = status;
    await save(data);
  }

  // ステータスが実際に変わったときだけメール送信する（同じ操作の連打で二重送信しないように）
  if (status !== previousStatus) {
    const plan = data.plans.find((p) => p.id === r.planId);
    if (status === "confirmed") {
      const mail = reservationConfirmed(r, plan);
      await sendMail({ type: "reservation_confirmed", to: r.customerEmail, ...mail });
    } else if (status === "cancelled") {
      const mail = reservationCancelled(r, plan, { refundedAmount: r.refundedAmount || 0 });
      await sendMail({ type: "reservation_cancelled", to: r.customerEmail, ...mail });
    }
  }

  return NextResponse.json({ ok: true, payment_status: r.paymentStatus, refunded_amount: r.refundedAmount || 0 });
}
