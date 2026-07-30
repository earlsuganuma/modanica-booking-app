import { NextResponse } from "next/server";
const { load, save } = require("../../../../../lib/store");

export const dynamic = "force-dynamic";

// 管理画面での表示順変更用。{ orderedIds: [planId, ...] } を受け取り、
// 配列内のインデックスをそのまま sortOrder として設定する。
export async function POST(request) {
  const { orderedIds } = await request.json();
  if (!Array.isArray(orderedIds)) {
    return NextResponse.json({ error: "ordered_ids_required" }, { status: 400 });
  }

  const data = await load();
  orderedIds.forEach((id, index) => {
    const plan = data.plans.find((p) => p.id === id);
    if (plan) plan.sortOrder = index;
  });
  await save(data);

  return NextResponse.json({ ok: true });
}
