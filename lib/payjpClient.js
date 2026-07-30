// PAY.JP（https://pay.jp）のサーバーサイドAPIクライアント。
//
// 決済フロー（オーソリ＋確定方式）:
//   1. お客様がWeb予約フォームでカード情報を入力すると、payjp.js（クライアント側）が
//      カード情報をトークン化する（カード番号は当サーバーには送られない＝PCI-DSS対応）。
//   2. サーバー側（このファイル）で、そのトークンを使い capture:false で「与信枠の確保（オーソリ）」
//      のみを行う。この時点ではまだ実際の引き落としは発生しない。
//   3. 管理者が予約を「確定」に変更した時点で、確保された与信枠を capture（支払い確定）する。
//      ここで初めてお客様のカードに実際に請求される。
//   4. 予約がキャンセルされた場合：
//      - まだ確定（capture）していなければ、与信枠を解放する（実際の請求は発生しない）。
//      - すでに確定済みなら、キャンセルポリシーに応じた金額を返金する。
//
// 環境変数 PAYJP_SECRET_KEY が未設定の場合は getClient() が null を返す。
// 呼び出し側はnullチェックのうえ、「決済機能が未設定です」等のエラーを返すこと。

let cachedClient = null;
let cachedKey = null;

function getClient() {
  const secretKey = process.env.PAYJP_SECRET_KEY || "";
  if (!secretKey) return null;
  if (cachedClient && cachedKey === secretKey) return cachedClient;
  const Payjp = require("payjp");
  cachedClient = Payjp(secretKey);
  cachedKey = secretKey;
  return cachedClient;
}

function isConfigured() {
  return !!process.env.PAYJP_SECRET_KEY;
}

// 与信枠の確保のみ行う（支払い確定はしない）。expiry_days=60（PAY.JPの上限）。
// ※3Dセキュア導入前の名残。現在の予約フローでは authorizeWithThreeDSecure() を使う。
async function authorize({ amount, token, metadata }) {
  const client = getClient();
  if (!client) throw new Error("PAY.JP未設定（PAYJP_SECRET_KEY）");
  return client.charges.create({
    amount,
    currency: "jpy",
    card: token,
    capture: false,
    expiry_days: 60,
    metadata: metadata || {},
  });
}

// PAY.JPのAPI v1をBasic認証で直接呼び出す共通ヘルパー。
// payjp（npmパッケージ）のSDKには charges.create/capture/refund 等の主要な操作しか
// ラップされていないため、3Dセキュア関連（three_d_secure指定・tds_finish・retrieve）は
// SDKを介さずAPIを直接叩く。
async function payjpFetch(path, { method = "GET", params } = {}) {
  const secretKey = process.env.PAYJP_SECRET_KEY || "";
  if (!secretKey) throw new Error("PAY.JP未設定（PAYJP_SECRET_KEY）");
  const auth = "Basic " + Buffer.from(`${secretKey}:`).toString("base64");
  const init = { method, headers: { Authorization: auth } };
  if (params) {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (typeof value === "object") {
        for (const [k2, v2] of Object.entries(value)) {
          body.set(`${key}[${k2}]`, String(v2));
        }
      } else {
        body.set(key, String(value));
      }
    }
    init.headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = body.toString();
  }
  const res = await fetch(`https://api.pay.jp/v1${path}`, init);
  const rawText = await res.text();
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (parseErr) {
    // DEBUG: JSONとしてパースできないレスポンスの内容を確認するための一時ログ（原因調査のため）
    console.error("DEBUG_PAYJP_NON_JSON_RESPONSE", JSON.stringify({ path, status: res.status, rawText: rawText.slice(0, 500) }));
  }
  if (!res.ok) {
    const err = new Error((data && data.error && data.error.message) || "PAY.JPとの通信に失敗しました。");
    err.payjpError = data && data.error;
    // DEBUG: PAY.JPエラーレスポンスの詳細をSentryで確認するための一時的な明示送信（原因調査のため）
    try {
      const Sentry = require("@sentry/nextjs");
      Sentry.captureException(err, { extra: { path, status: res.status, data, rawText: rawText.slice(0, 1000) } });
    } catch (sentryErr) {}
    throw err;
  }
  return data;
}

// 支払い作成時の3Dセキュア（ゲスト予約＝会員登録なしのフローに合致する方式）。
// three_d_secure:true を指定すると、この時点では課金されず「3Dセキュア処理待ち」の
// 支払いオブジェクトが作られる（paid:false, three_d_secure_status:"unverified"）。
// capture:false も併用し、3Dセキュア完了後も与信確保のみの状態にする。
async function authorizeWithThreeDSecure({ amount, token, metadata }) {
  return payjpFetch("/charges", {
    method: "POST",
    params: {
      amount,
      currency: "jpy",
      card: token,
      capture: false,
      expiry_days: 60,
      three_d_secure: true,
      metadata: metadata || {},
    },
  });
}

// クライアント側で3Dセキュア認証（iframe）が完了した後に呼び出し、支払いを確定させる。
// （capture:falseのため、ここで確定するのは「オーソリの完了」であり、実際の請求はまだ発生しない）
async function finishThreeDSecure(chargeId) {
  return payjpFetch(`/charges/${encodeURIComponent(chargeId)}/tds_finish`, { method: "POST" });
}

// 支払いオブジェクトを取得する（金額・カード情報・3Dセキュア認証状態の確認に使用）。
async function retrieveCharge(chargeId) {
  return payjpFetch(`/charges/${encodeURIComponent(chargeId)}`);
}

// 確保した与信枠の支払いを確定する（実際にお客様へ請求される）。
async function capture(chargeId, amount) {
  const client = getClient();
  if (!client) throw new Error("PAY.JP未設定（PAYJP_SECRET_KEY）");
  const params = {};
  if (amount != null) params.amount = amount;
  return client.charges.capture(chargeId, params);
}

// 与信枠の解放、または確定済み支払いの返金（amount省略時は全額）。
async function refund(chargeId, amount) {
  const client = getClient();
  if (!client) throw new Error("PAY.JP未設定（PAYJP_SECRET_KEY）");
  const params = {};
  if (amount != null) params.amount = amount;
  return client.charges.refund(chargeId, params);
}

module.exports = { getClient, isConfigured, authorize, capture, refund };
