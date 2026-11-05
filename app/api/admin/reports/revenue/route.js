import { NextResponse } from "next/server";
const { load } = require("../../../../../lib/store");
const { buildRevenueReport } = require("../../../../../lib/reports");
const { todayStr } = require("../../../../../lib/dateUtil");
const { listOtaBlocks, roomByResource, channelLabel } = require("../../../../../lib/otaBlocks");

export const dynamic = "force-dynamic";

// GET /api/admin/reports/revenue?year=2026&month=7
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const today = todayStr();
  const year = Number(searchParams.get("year")) || Number(today.slice(0, 4));
  const month = Number(searchParams.get("month")) || Number(today.slice(5, 7));

  const data = await load();
  // OTA経由の予約（iCal取り込み分）も合算する。取得に失敗しても、自社分の集計は返す。
  let ota = [];
  try {
    ota = (await listOtaBlocks()).map((b) => ({
      ...b,
      channelLabel: channelLabel(b.channel),
      roomLabel: (roomByResource(b.resourceId) || {}).label,
    }));
  } catch (e) {
    ota = [];
  }
  const report = buildRevenueReport(data, year, month, ota);
  return NextResponse.json(report);
}
