import { NextResponse } from "next/server";
const { load, save } = require("../../../../../lib/store");
const { sendMail } = require("../../../../../lib/mailer");
const { reservationConfirmed, reservationCancelled } = require("../../../../../lib/emailTemplates");
const { computeAtRisk } = require("../../../../../lib/priorityRisk");

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
    },
  });
}

export async function PATCH(request, { params }) {
  const { id: idParam } = await params;
  const body = await request.json();
  const { status } = body;
  if (!["confirmed", "cancelled", "pending_review"].includes(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  const data = await load();
  const id = Number(idParam);
  const r = data.reservations.find((x) => x.id === id);
  if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const previousStatus = r.status;
  r.status = status;
  await save(data);

  // ステータスが実際に変わったときだけメール送信する（同じ操作の連打で二重送信しないように）
  if (status !== previousStatus) {
    const plan = data.plans.find((p) => p.id === r.planId);
    if (status === "confirmed") {
      const mail = reservationConfirmed(r, plan);
      await sendMail({ type: "reservation_confirmed", to: r.customerEmail, ...mail });
    } else if (status === "cancelled") {
      const mail = reservationCancelled(r, plan);
      await sendMail({ type: "reservation_cancelled", to: r.customerEmail, ...mail });
    }
  }

  return NextResponse.json({ ok: true });
}
