import { NextResponse } from "next/server";
import { POST as createReservation } from "../../../reservations/route";
const draftToken = require("../../../../../lib/draftToken");
const payjpV2 = require("../../../../../lib/payjpV2Client");
const payjpGateway = require("../../../../../lib/paymentGateway");

export const dynamic = "force-dynamic";

// 決済後の戻りページから呼ばれる。暗号化トークンから予約内容を復元し、
// /api/reservations と同じ検証・作成処理（Payment Flow の状態・金額の検証を含む）を実行する。
// 同じ決済IDで再度呼ばれても、作成済みの予約IDを返すだけで二重登録はしない。
export async function POST(request) {
  const { token, paymentFlowId } = await request.json();
  const sealed = token ? draftToken.open(token) : null;
  if (!sealed || !sealed.draft || !sealed.flowId) {
    return NextResponse.json(
      { error: "invalid_token", message: "お申込み内容の確認に失敗しました（有効期限切れの可能性があります）。お手数ですが最初からやり直してください。" },
      { status: 400 }
    );
  }
  if (paymentFlowId && paymentFlowId !== sealed.flowId) {
    return NextResponse.json({ error: "flow_mismatch", message: "お支払い情報が一致しません。" }, { status: 400 });
  }

  const headers = new Headers(request.headers);
  headers.delete("content-length");
  const inner = new Request(request.url, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...sealed.draft, payjpPaymentFlowId: sealed.flowId, paymentMethodType: sealed.method }),
  });
  const response = await createReservation(inner);

  // 決済は済んでいるのに予約を作れなかった場合（日程が直前に埋まった等）は、決済を取り消す。
  // 決済未完了・処理中・一時的な通信障害の場合は取り消さない。
  const keepErrors = ["payment_not_completed", "payment_processing", "payment_lookup_failed", "payment_not_configured", "amount_mismatch"];
  if (response.status >= 400 && response.status !== 429 && response.status !== 502 && response.status !== 503) {
    const cloned = response.clone();
    const payload = await cloned.json().catch(() => ({}));
    if (!keepErrors.includes(payload.error)) {
      try {
        const flow = await payjpV2.retrievePaymentFlow(sealed.flowId);
        await payjpGateway.releaseOrRefundFlow(flow);
        payload.paymentReleased = true;
        return NextResponse.json(
          { ...payload, message: `${payload.message || "予約を作成できませんでした。"}（お支払いは取り消されています）` },
          { status: response.status }
        );
      } catch (e) {
        return NextResponse.json(
          { ...payload, message: `${payload.message || "予約を作成できませんでした。"}お支払いの取り消しに失敗した可能性があるため、お手数ですが店舗までご連絡ください。` },
          { status: response.status }
        );
      }
    }
  }
  return response;
}
