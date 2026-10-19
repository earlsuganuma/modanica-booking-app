import { NextResponse } from "next/server";
const { runPaymentWatch } = require("../../../../lib/paymentWatch");

export const dynamic = "force-dynamic";

// 毎日の決済チェック（VPSのcronから呼び出す）。環境変数 CRON_SECRET と同じ値を
// ヘッダー x-cron-secret に付けたリクエストだけを受け付ける。
// ?dry=1 を付けると、メールは送らず、チェック結果だけを返す（動作確認用）。
export async function POST(request) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) {
    return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  }
  if (request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dry = new URL(request.url).searchParams.get("dry") === "1";
  try {
    const result = await runPaymentWatch({ notify: !dry });
    return NextResponse.json({
      ok: true,
      stale: result.stale.length,
      orphans: result.orphans.length,
      listError: result.listError,
      notified: result.notified,
    });
  } catch (e) {
    console.error("payment-check failed:", e);
    return NextResponse.json({ error: "failed", message: String((e && e.message) || e) }, { status: 500 });
  }
}
