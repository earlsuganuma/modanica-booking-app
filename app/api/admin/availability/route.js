import { NextResponse } from "next/server";
const { checkAvailability } = require("../../../../lib/availabilityCheck");

export const dynamic = "force-dynamic";

// 管理画面の予約登録用：問い合わせ専用日・最終受付期限の制限を適用しない空き状況の確認。
// /api/admin/* はログイン必須（proxy.js）。
export async function POST(request) {
  const body = await request.json();
  const { status, body: result } = await checkAvailability(body, { skipRestrictions: true });
  return NextResponse.json(result, { status });
}
