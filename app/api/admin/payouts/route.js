import { NextResponse } from "next/server";
const { load } = require("../../../../lib/store");
const { setSetting } = require("../../../../lib/appSettings");
const { KEYS, loadPayoutSettings, buildPayoutForecast } = require("../../../../lib/payoutForecast");

export const dynamic = "force-dynamic";

// 管理画面専用（/api/admin/* はログイン必須）。入金予定の概算と、手数料率の設定。
export async function GET() {
  const [data, settings] = await Promise.all([load(), loadPayoutSettings()]);
  const { payouts, pendingAuth } = buildPayoutForecast(data, settings);
  return NextResponse.json({ settings, payouts, pendingAuth });
}

export async function PUT(request) {
  const body = await request.json();
  const checks = [
    ["cardFeeRate", KEYS.cardFeeRate, 0, 20],
    ["paypayFeeRate", KEYS.paypayFeeRate, 0, 20],
    ["transferFee", KEYS.transferFee, 0, 5000],
  ];
  for (const [name, , min, max] of checks) {
    const v = Number(body[name]);
    if (!Number.isFinite(v) || v < min || v > max) {
      return NextResponse.json({ error: "invalid_value", message: `${name} の値が正しくありません。` }, { status: 400 });
    }
  }
  try {
    for (const [name, key] of checks) await setSetting(key, Number(body[name]));
  } catch (e) {
    console.error("setSetting failed:", e.message);
    return NextResponse.json(
      { error: "save_failed", message: "保存に失敗しました。データベースの準備（テーブル作成）が済んでいない可能性があります。" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
