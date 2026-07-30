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
