// 予約に保存された決済ID（payjpChargeId）の種類で v1 / v2 を振り分ける管理画面用ラッパー。
//   "pfw_..." → PAY.JP API v2（Payment Flow）
//   "ch_..."  → PAY.JP API v1（Charge。移行前の既存予約）

const v1 = require("./payjpClient");
const v2 = require("./payjpV2Client");

// 仮売上の確定。戻り値は確定金額。
async function capture(paymentId) {
  if (v2.isV2Id(paymentId)) {
    const flow = await v2.capturePaymentFlow(paymentId);
    return flow.amount_received != null ? flow.amount_received : flow.amount;
  }
  const charge = await v1.capture(paymentId);
  return charge.amount;
}

// 仮売上（未確定）の解放。請求は発生しない。
async function releaseAuthorization(paymentId) {
  if (v2.isV2Id(paymentId)) return v2.cancelPaymentFlow(paymentId);
  return v1.refund(paymentId);
}

// 確定済み支払いの返金（amount省略で全額）。
async function refund(paymentId, amount) {
  if (v2.isV2Id(paymentId)) {
    return v2.createRefund({
      paymentFlowId: paymentId,
      amount,
      idempotencyKey: `refund-${paymentId}-${amount == null ? "full" : amount}-${Date.now()}`,
    });
  }
  return v1.refund(paymentId, amount);
}

// 予約を作れなかった Payment Flow（v2）を取り消す：仮売上なら解放、確定済み（PayPay）なら全額返金。
async function releaseOrRefundFlow(flow) {
  if (!flow || !v2.isV2Id(flow.id)) return;
  if (flow.status === "requires_capture") return v2.cancelPaymentFlow(flow.id);
  if (flow.status === "succeeded") {
    return v2.createRefund({ paymentFlowId: flow.id, idempotencyKey: `autorefund-${flow.id}` });
  }
}

// エラーから表示用メッセージを取り出す（v1 SDK / v2 クライアント両対応）。
function errorMessage(e, fallback) {
  return (
    (e && e.payjpError && e.payjpError.message) ||
    (e && e.response && e.response.body && e.response.body.error && e.response.body.error.message) ||
    fallback
  );
}

module.exports = { capture, releaseAuthorization, refund, releaseOrRefundFlow, errorMessage };
