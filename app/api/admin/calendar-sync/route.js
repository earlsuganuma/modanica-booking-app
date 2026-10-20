import { NextResponse } from "next/server";
const { load } = require("../../../../lib/store");
const { syncReservation, isConfigured } = require("../../../../lib/googleCalendar");

export const dynamic = "force-dynamic";

// 管理画面専用（/api/admin/* はログイン必須）：これから先の予約を、Googleカレンダーに一括で反映する。
// 初回の設定後や、反映に失敗した予約があったときに、ブラウザでこのURLを開いて実行する。何度実行しても同じ結果になる。
export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json({ error: "not_configured", message: "Googleカレンダー連携の環境変数が未設定です。" }, { status: 400 });
  }
  const data = await load();
  const today = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const targets = data.reservations.filter((r) => r.status !== "cancelled" && String(r.endDatetime) >= todayStr);
  let ok = 0;
  const failed = [];
  for (const r of targets) {
    const res = await syncReservation(r, data.plans.find((p) => p.id === r.planId), data.options);
    if (res.ok) ok += 1;
    else failed.push({ id: r.id, error: res.error });
  }
  return NextResponse.json({ total: targets.length, synced: ok, failed });
}
