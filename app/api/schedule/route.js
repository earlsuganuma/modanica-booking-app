import { NextResponse } from "next/server";
const { load } = require("../../../lib/store");
const { addDays } = require("../../../lib/timeTemplates");

export const dynamic = "force-dynamic";

// GET /api/schedule?resourceIds=cafe,bbq&date=2026-08-25
// 指定リソースの指定日における既存予約（キャンセル除く）の時間帯を返す。
// 公開画面から呼ばれるため、顧客名などの個人情報は一切含めない。
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const resourceIds = (searchParams.get("resourceIds") || "").split(",").filter(Boolean);
  const date = searchParams.get("date");

  if (!date || resourceIds.length === 0) {
    return NextResponse.json({ segments: [] });
  }

  const dayStart = `${date}T00:00`;
  const dayEnd = `${addDays(date, 1)}T00:00`;

  const data = await load();
  const segments = data.reservations
    .filter((r) => r.status !== "cancelled")
    .filter((r) => r.resourceIds.some((id) => resourceIds.includes(id)))
    .filter((r) => r.startDatetime < dayEnd && r.endDatetime > dayStart)
    .map((r) => ({ start: r.startDatetime, end: r.endDatetime }));

  return NextResponse.json({ segments });
}
