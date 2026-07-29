import { NextResponse } from "next/server";
const { load } = require("../../../../lib/store");
const { computeAtRisk } = require("../../../../lib/priorityRisk");

export const dynamic = "force-dynamic";

// 管理画面専用の予約一覧API（middleware.jsにより /api/admin/* はログイン必須）。
// 顧客氏名・連絡先などの個人情報を含むため、必ず認証済みのリクエストのみが通ること。
export async function GET() {
  const data = await load();
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
        customer_name: r.customerName,
        customer_email: r.customerEmail,
        customer_tel: r.customerTel,
        note: r.note,
        status: r.status,
        total_price: r.totalPrice,
        created_at: r.createdAt,
        at_risk: r.status !== "cancelled" ? computeAtRisk(data, r) : false,
      };
    });
  return NextResponse.json({ reservations });
}
