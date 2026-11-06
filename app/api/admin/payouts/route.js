import { NextResponse } from "next/server";
const { load } = require("../../../../lib/store");
const { setSetting } = require("../../../../lib/appSettings");
const { KEYS, loadPayoutSettings, buildPayoutForecast } = require("../../../../lib/payoutForecast");
const { listOtaBlocks } = require("../../../../lib/otaBlocks");
const { buildOtaPayouts } = require("../../../../lib/otaPayout");

export const dynamic = "force-dynamic";

// 管理画面専用（/api/admin/* はログイン必須）。入金予定の概算と、手数料率の設定。
export async function GET() {
  const [data, settings] = await Promise.all([load(), loadPayoutSettings()]);
  const { payouts, pendingAuth } = buildPayoutForecast(data, settings);
  // OTA（Booking.com）の入金予定の概算。取得に失敗しても、PAY.JP分は返す。
  let ota = { payouts: [], unpriced: 0, commissionRate: settings.otaCommissionRate, deduct: settings.otaDeduct === 1 };
  try {
    ota = buildOtaPayouts(await listOtaBlocks(), settings);
  } catch (e) {
    console.error("buildOtaPayouts failed:", e.message);
  }
  return NextResponse.json({ settings, payouts, pendingAuth, ota });
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
  // OTAの設定（任意。送られたときだけ検証して保存する）
  const otaChecks = [
    ["otaCommissionRate", KEYS.otaCommissionRate, 0, 40],
    ["otaDeduct", KEYS.otaDeduct, 0, 1],
  ];
  for (const [name, , min, max] of otaChecks) {
    if (body[name] === undefined) continue;
    const v = Number(body[name]);
    if (!Number.isFinite(v) || v < min || v > max) {
      return NextResponse.json({ error: "invalid_value", message: `${name} の値が正しくありません。` }, { status: 400 });
    }
  }
  try {
    for (const [name, key] of checks) await setSetting(key, Number(body[name]));
    for (const [name, key] of otaChecks) if (body[name] !== undefined) await setSetting(key, Number(body[name]));
  } catch (e) {
    console.error("setSetting failed:", e.message);
    return NextResponse.json(
      { error: "save_failed", message: "保存に失敗しました。データベースの準備（テーブル作成）が済んでいない可能性があります。" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
