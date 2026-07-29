import { NextResponse } from "next/server";
const { load } = require("../../../../../lib/store");
const { buildRevenueReport } = require("../../../../../lib/reports");
const { todayStr } = require("../../../../../lib/dateUtil");

export const dynamic = "force-dynamic";

// GET /api/admin/reports/revenue?year=2026&month=7
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const today = todayStr();
  const year = Number(searchParams.get("year")) || Number(today.slice(0, 4));
  const month = Number(searchParams.get("month")) || Number(today.slice(5, 7));

  const data = await load();
  const report = buildRevenueReport(data, year, month);
  return NextResponse.json(report);
}
