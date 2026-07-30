import { NextResponse } from "next/server";
const { getPlan } = require("../../../../lib/plans");

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ plan });
}
