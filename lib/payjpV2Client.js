// PAY.JP API v2 のサーバーサイドクライアント（fetch + Bearer認証）。
//
// 決済の流れ:
//   カード   : Payment Flow を capture_method=manual で作成 → お客様が Payment Widgets で入力・3Dセキュア
//              → 仮売上（status=requires_capture）→ 管理者が予約「確定」で capture（売上確定）。
//   PayPay   : Payment Flow を capture_method=automatic で作成 → PayPayで承認 → 即時 succeeded（売上確定）。
//              キャンセル時は payment_refunds で返金。
// Payment Flow の id は "pfw_" で始まる（v1 の charge は "ch_"）。予約の payjpChargeId に保存する。

const API_BASE = "https://api.pay.jp/v2";

function secretKey() {
  return process.env.PAYJP_SECRET_KEY || "";
}

function isConfigured() {
  return !!secretKey();
}

function isV2Enabled() {
  return process.env.PAYJP_API_VERSION === "v2" && isConfigured();
}

function isV2Id(id) {
  return typeof id === "string" && id.startsWith("pfw_");
}

async function v2Fetch(path, { method = "GET", body, idempotencyKey } = {}) {
  const key = secretKey();
  if (!key) throw new Error("PAY.JP未設定（PAYJP_SECRET_KEY）");
  const headers = { Authorization: `Bearer ${key}` };
  const init = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`${API_BASE}${path}`, init);
  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (e) {
    data = { raw };
  }
  if (!res.ok) {
    // v2のエラーは RFC 9457 形式：{status, code, title, detail, errors?:[{field,message}]}
    const errObj = (data && (data.error || data)) || {};
    const fieldErrors = Array.isArray(errObj.errors)
      ? errObj.errors.map((x) => `${x.field}: ${x.message}`).join(", ")
      : "";
    const detail = [errObj.code, errObj.detail || errObj.message || errObj.title, fieldErrors].filter(Boolean).join(" / ");
    console.error(`[payjp-v2] ${method} ${path} -> ${res.status}`, JSON.stringify(errObj));
    const err = new Error(detail || "PAY.JPとの通信に失敗しました。");
    err.payjpError = { ...errObj, message: detail || errObj.message };
    err.status = res.status;
    throw err;
  }
  return data;
}

// Payment Flow を作成する。method は "card" または "paypay"。
async function createPaymentFlow({ amount, method, metadata }) {
  const base = {
    amount,
    currency: "jpy",
    payment_method_types: [method],
    capture_method: method === "card" ? "manual" : "automatic",
    metadata: metadata || {},
  };
  if (method === "card") {
    // 仮売上の期限を延長する（国内カードは通常7日→延長で最大30日程度）。
    // APIが受け付けない場合は、延長指定なしで作り直す。
    const withExt = {
      ...base,
      payment_method_options: { card: { request_extended_authorization: process.env.PAYJP_EXTENDED_AUTH || "if_available" } },
    };
    if (process.env.PAYJP_EXTENDED_AUTH !== "off") {
      try {
        return await v2Fetch("/payment_flows", { method: "POST", body: withExt });
      } catch (e) {
        if (!(e && e.status === 400)) throw e;
      }
    }
  }
  return v2Fetch("/payment_flows", { method: "POST", body: base });
}

function retrievePaymentFlow(id) {
  return v2Fetch(`/payment_flows/${encodeURIComponent(id)}`);
}

// 仮売上の支払いを確定する（全額）。
function capturePaymentFlow(id) {
  return v2Fetch(`/payment_flows/${encodeURIComponent(id)}/capture`, { method: "POST" });
}

// 未確定の Payment Flow をキャンセルする（仮売上の解放）。
function cancelPaymentFlow(id) {
  return v2Fetch(`/payment_flows/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}

// 確定済みの支払いを返金する（amount省略時は全額）。
function createRefund({ paymentFlowId, amount, reason, idempotencyKey }) {
  const body = { payment_flow: paymentFlowId };
  if (amount != null) body.amount = amount;
  if (reason) body.reason = reason;
  return v2Fetch("/payment_refunds", { method: "POST", body, idempotencyKey });
}

function retrievePaymentMethod(id) {
  return v2Fetch(`/payment_methods/${encodeURIComponent(id)}`);
}

// Payment Flow から表示用のカード情報（ブランド・下4桁）を取り出す。取得できなくても決済には影響しない。
async function describePaymentMethod(flow, method) {
  if (method === "paypay") return { brand: "PayPay", last4: null };
  try {
    let pm = flow.payment_method;
    if (typeof pm === "string") pm = await retrievePaymentMethod(pm);
    const card = pm && pm.card;
    if (card) return { brand: card.brand || "card", last4: card.last4 || null };
  } catch (e) {
    // 表示用情報なので無視
  }
  return { brand: "card", last4: null };
}

module.exports = {
  isConfigured,
  isV2Enabled,
  isV2Id,
  createPaymentFlow,
  retrievePaymentFlow,
  capturePaymentFlow,
  cancelPaymentFlow,
  createRefund,
  describePaymentMethod,
};
