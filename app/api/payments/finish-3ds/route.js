import { NextResponse } from "next/server";
const payjpClient = require("../../../../lib/payjpClient");

export const dynamic = "force-dynamic";

// クライアント側で payjp.openThreeDSecureIframe(chargeId) が完了した直後に呼び出す。
// PAY.JP側の支払いオブジェクトを「3Dセキュア完了」状態に確定させる。
// three_d_secure_status が unverified/error のまま tds_finish を呼ぶと失敗するため、
// その場合はエラーを返し、クライアント側はカード情報入力からやり直す必要がある。
export async function POST(request) {
  const { chargeId } = await request.json();
  if (!chargeId) return NextResponse.json({ error: "charge_id_required" }, { status: 400 });

  try {
    await payjpClient.finishThreeDSecure(chargeId);
    const charge = await payjpClient.retrieveCharge(chargeId);
    return NextResponse.json({ ok: true, threeDSecureStatus: charge.three_d_secure_status });
  } catch (e) {
    const message =
      (e && e.payjpError && e.payjpError.message) ||
      "本人認証（3Dセキュア）の確認に失敗しました。お手数ですがカード情報の入力からやり直してください。";
    return NextResponse.json({ error: "three_d_secure_failed", message }, { status: 402 });
  }
}
