// Googleカレンダー連携（予約 → 専用カレンダーへの片方向の書き込み）。
// サービスアカウントで認証し、予約ごとに1件の予定を作成・更新・削除する。
// 予定IDは予約IDから決まる値（mdn + 6桁）にしているので、DBに追加の列は要らない。
//
// 必要な環境変数（未設定の場合は何もしない）:
//   GOOGLE_CALENDAR_ID                  … 連携先カレンダーのID
//   GOOGLE_SERVICE_ACCOUNT_JSON_BASE64  … サービスアカウント鍵(JSON)をbase64にした文字列
//   ADMIN_BASE_URL（任意）              … 管理画面のURL（例: https://reserve.example.com）。予定の説明に詳細リンクを入れる
//
// カレンダーへの反映に失敗しても予約・決済の処理は止めない（ログのみ）。

const crypto = require("crypto");
const { optionsText, customerNote } = require("./emailTemplates");

const SCOPE = "https://www.googleapis.com/auth/calendar";
const API = "https://www.googleapis.com/calendar/v3";
const TZ = "Asia/Tokyo";

let tokenCache = { token: null, exp: 0 };

function isConfigured() {
  return !!(process.env.GOOGLE_CALENDAR_ID && process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64);
}

function loadKey() {
  const json = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64, "base64").toString("utf8");
  return JSON.parse(json);
}

function b64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache.token && tokenCache.exp - 60 > now) return tokenCache.token;
  const key = loadKey();
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })
  );
  const signature = crypto.sign("RSA-SHA256", Buffer.from(`${header}.${claim}`), key.private_key);
  const assertion = `${header}.${claim}.${b64url(signature)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(8000),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`token: ${res.status} ${JSON.stringify(json)}`);
  tokenCache = { token: json.access_token, exp: now + (json.expires_in || 3600) };
  return tokenCache.token;
}

async function gcal(method, path, body) {
  const token = await getAccessToken();
  const res = await fetch(`${API}/calendars/${encodeURIComponent(process.env.GOOGLE_CALENDAR_ID)}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text();
  return { status: res.status, ok: res.ok, text };
}

function eventId(reservationId) {
  return `mdn${String(reservationId).padStart(6, "0")}`;
}

const PAYMENT_LABEL = {
  none: "決済なし（現地払い等）",
  authorized: "カード与信済み（未確定）",
  captured: "決済済み",
  released: "与信解放済み",
  refunded: "返金済み",
  partially_refunded: "一部返金済み",
};

const STATUS_LABEL = { confirmed: "予約確定", pending_review: "要確認" };

function buildEvent(reservation, plan, allOptions) {
  const r = reservation;
  const opts = optionsText(r, allOptions);
  const note = customerNote(r);
  const base = (process.env.ADMIN_BASE_URL || "").replace(/\/$/, "");
  const lines = [
    `プラン：${plan ? plan.name : r.planId}`,
    opts ? `オプション：${opts}` : null,
    `人数：${r.guestCount}名`,
    r.customerTel ? `電話：${r.customerTel}` : null,
    r.customerEmail ? `メール：${r.customerEmail}` : null,
    r.customerAddress ? `住所：${r.customerAddress}` : null,
    `金額：${Number(r.totalPrice || 0).toLocaleString("ja-JP")}円`,
    `支払い：${PAYMENT_LABEL[r.paymentStatus] || r.paymentStatus || "-"}`,
    note ? `備考：${note}` : null,
    base ? `詳細：${base}/admin/reservations/${r.id}` : null,
  ].filter(Boolean);
  const naive = (s) => `${String(s).slice(0, 16)}:00`;
  return {
    id: eventId(r.id),
    summary: `${r.customerName}[${STATUS_LABEL[r.status] || r.status}]`,
    description: lines.join("\n"),
    start: { dateTime: naive(r.startDatetime), timeZone: TZ },
    end: { dateTime: naive(r.endDatetime), timeZone: TZ },
    colorId: r.status === "confirmed" ? "6" : "8",
    status: "confirmed",
  };
}

// 予約の状態に合わせて予定を作成・更新・削除する。例外は投げない。
async function syncReservation(reservation, plan, allOptions) {
  if (!isConfigured() || !reservation) return { skipped: true };
  try {
    const id = eventId(reservation.id);
    if (reservation.status === "cancelled") {
      const res = await gcal("DELETE", `/events/${id}`);
      if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`delete ${res.status} ${res.text}`);
      return { ok: true, action: "deleted" };
    }
    const event = buildEvent(reservation, plan, allOptions);
    let res = await gcal("PUT", `/events/${id}`, event);
    if (res.status === 404) {
      res = await gcal("POST", "/events", event);
      if (res.status === 409) res = await gcal("PUT", `/events/${id}`, event);
    }
    if (!res.ok) throw new Error(`upsert ${res.status} ${res.text}`);
    return { ok: true, action: "upserted" };
  } catch (e) {
    console.error(`[googleCalendar] reservation ${reservation.id} sync failed:`, e && e.message);
    return { ok: false, error: e && e.message };
  }
}

module.exports = { isConfigured, syncReservation, eventId };
