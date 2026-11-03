import { NextResponse } from "next/server";
const { runIcalSync } = require("../../../../lib/icalSync");
const { syncOtaBlocks } = require("../../../../lib/googleCalendar");

export const dynamic = "force-dynamic";

// OTA（Booking.com・Airbnb）の iCal 取り込み（VPSのcronから15分ごとに呼び出す）。
// 環境変数 CRON_SECRET と同じ値をヘッダー x-cron-secret に付けたリクエストだけを受け付ける。
// ?dry=1 を付けるとメールは送らない（取り込み自体は行う）。
export async function POST(request) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  if (request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dry = new URL(request.url).searchParams.get("dry") === "1";
  try {
    const result = await runIcalSync({ notify: !dry });
    // 取り込んだOTA予約を、Googleカレンダーにも反映する（未設定なら何もしない。失敗しても取り込みの結果は返す）
    const gcal = await syncOtaBlocks();
    return NextResponse.json({
      ok: true,
      skipped: result.skipped || null,
      feeds: result.feeds,
      mail: result.mail ? result.mail.status : null,
      feedWarning: result.feedWarning ? result.feedWarning.kind : null,
      gcal: gcal.skipped ? "skipped" : gcal.ok ? { upserted: gcal.upserted, deleted: gcal.deleted } : "failed",
    });
  } catch (e) {
    console.error("ical-sync failed:", e);
    return NextResponse.json({ error: "failed", message: String((e && e.message) || e) }, { status: 500 });
  }
}
