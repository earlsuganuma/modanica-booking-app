import { NextResponse } from "next/server";
const { listPlans } = require("../../../../lib/plans");

export const dynamic = "force-dynamic";

export async function GET() {
  const plans = await listPlans();
  return NextResponse.json({ plans });
}
