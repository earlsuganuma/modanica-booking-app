import { NextResponse } from "next/server";
const { load, save } = require("../../../../../../lib/store");

export const dynamic = "force-dynamic";

// body: { planId, attach: boolean, isDefault?: boolean }
export async function POST(request, { params }) {
  const body = await request.json();
  const { planId, attach, isDefault } = body;
  if (!planId) return NextResponse.json({ error: "plan_id_required" }, { status: 400 });

  const data = await load();
  const optionId = params.id;

  const existingIndex = data.planOptions.findIndex((po) => po.optionId === optionId && po.planId === planId);

  if (attach) {
    if (existingIndex >= 0) {
      data.planOptions[existingIndex].isDefault = !!isDefault;
    } else {
      data.planOptions.push({ planId, optionId, isDefault: !!isDefault });
    }
  } else if (existingIndex >= 0) {
    data.planOptions.splice(existingIndex, 1);
  }

  await save(data);
  return NextResponse.json({ ok: true });
}
