import { NextResponse } from "next/server";
const { load, save } = require("../../../../../lib/store");

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.json();
  const data = await load();
  const opt = data.options.find((o) => o.id === id);
  if (!opt) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (body.name !== undefined) opt.name = body.name;
  if (body.price !== undefined) opt.price = Number(body.price) || 0;
  if (body.description !== undefined) opt.description = body.description;
  if (body.unit !== undefined) opt.unit = body.unit === "quantity" ? "quantity" : "flag";
  if (body.maxQuantity !== undefined) {
    opt.maxQuantity = body.maxQuantity === "" || body.maxQuantity === null ? null : Number(body.maxQuantity);
  }
  if (body.unitLabel !== undefined) {
    opt.unitLabel = opt.unit === "quantity" ? body.unitLabel || "個" : null;
  }
  if (body.imageUrl !== undefined) {
    opt.imageUrl = body.imageUrl || null;
  }

  await save(data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const data = await load();
  data.options = data.options.filter((o) => o.id !== id);
  data.planOptions = data.planOptions.filter((po) => po.optionId !== id);
  await save(data);
  return NextResponse.json({ ok: true });
}
