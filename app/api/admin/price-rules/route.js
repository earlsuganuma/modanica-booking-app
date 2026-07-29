import { NextResponse } from "next/server";
const { load, save } = require("../../../../lib/store");

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await load();
  const rules = [...data.priceRules].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return NextResponse.json({ priceRules: rules });
}

export async function POST(request) {
  const body = await request.json();
  const { label, startDate, endDate, coefficient, type } = body;

  if (!label || !startDate || !coefficient) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const coeff = Number(coefficient);
  if (Number.isNaN(coeff) || coeff <= 0) {
    return NextResponse.json({ error: "invalid_coefficient" }, { status: 400 });
  }

  const data = await load();
  const id = data.nextPriceRuleId || 1;
  data.priceRules.push({
    id,
    label,
    startDate,
    endDate: endDate || startDate,
    coefficient: coeff,
    type: type || "custom",
  });
  data.nextPriceRuleId = id + 1;
  await save(data);

  return NextResponse.json({ id });
}
