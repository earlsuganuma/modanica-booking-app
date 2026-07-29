import { NextResponse } from "next/server";
const { load, save } = require("../../../../lib/store");

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await load();
  const options = data.options.map((o) => ({
    ...o,
    plans: data.planOptions
      .filter((po) => po.optionId === o.id)
      .map((po) => ({ planId: po.planId, isDefault: !!po.isDefault })),
  }));
  const plans = data.plans
    .map((p) => ({ id: p.id, code: p.code, name: p.name, category: p.category }))
    .sort((a, b) => a.code - b.code);
  return NextResponse.json({ options, plans });
}

export async function POST(request) {
  const body = await request.json();
  const { name, price, description, unit, maxQuantity, unitLabel } = body;
  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });

  const data = await load();
  const seq = data.nextOptionSeq || 1;
  const id = `opt_custom_${seq}`;
  data.options.push({
    id,
    name,
    price: Number(price) || 0,
    unit: unit === "quantity" ? "quantity" : "flag",
    maxQuantity: maxQuantity === "" || maxQuantity === undefined || maxQuantity === null ? null : Number(maxQuantity),
    unitLabel: unit === "quantity" ? unitLabel || "個" : null,
    description: description || "",
  });
  data.nextOptionSeq = seq + 1;
  await save(data);

  return NextResponse.json({ id });
}
