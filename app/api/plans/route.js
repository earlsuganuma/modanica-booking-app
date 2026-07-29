import { NextResponse } from "next/server";
const { listPlans } = require("../../../lib/plans");

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const plans = await listPlans(category || undefined);
  return NextResponse.json({ plans });
}
