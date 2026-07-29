import { NextResponse } from "next/server";
const { load, save } = require("../../../../../lib/store");

export const dynamic = "force-dynamic";

export async function DELETE(request, { params }) {
  const data = await load();
  const id = Number(params.id);
  data.priceRules = data.priceRules.filter((r) => r.id !== id);
  await save(data);
  return NextResponse.json({ ok: true });
}

export async function PATCH(request, { params }) {
  const body = await request.json();
  const data = await load();
  const id = Number(params.id);
  const rule = data.priceRules.find((r) => r.id === id);
  if (!rule) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (body.label !== undefined) rule.label = body.label;
  if (body.startDate !== undefined) rule.startDate = body.startDate;
  if (body.endDate !== undefined) rule.endDate = body.endDate;
  if (body.coefficient !== undefined) rule.coefficient = Number(body.coefficient);
  if (body.type !== undefined) rule.type = body.type;

  await save(data);
  return NextResponse.json({ ok: true });
}
