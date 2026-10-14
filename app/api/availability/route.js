import { NextResponse } from "next/server";
const { checkAvailability } = require("../../../lib/availabilityCheck");

export const dynamic = "force-dynamic";

export async function POST(request) {
  const body = await request.json();
  const { status, body: result } = await checkAvailability(body);
  return NextResponse.json(result, { status });
}
