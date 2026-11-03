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
const { query } = require("./db");
const { getSettings, setSetting } = require("./appSettings");
const { ROOMS, channelLabel, toOtaBlock } = require("./otaBlocks");
const { NIGHT_START, NIGHT_END } = require("./ical");
const { todayStr } = require("./dateUtil");
const { addDays } = require("./ical");

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

const STATUS_LABEL = { confirmed: "予約確定", pending_review: "要確認", visited: "来店済み", no_show: "未来店" };

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
    colorId: r.status === "confirmed" ? "6" : r.status === "visited" ? "9" : "8",
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

// ---------- OTA（Booking.com・Airbnb）の予約 → 同じカレンダー ----------
// iCalで取り込んだ OTA の泊（ota_blocks）を、チェックイン日16:00〜チェックアウト日11:00の予定として入れる。
// 予定IDは「mdo + ブロックID」。内容が変わったブロックだけを更新し、OTA側で消えたブロックの予定は削除する。
// どのブロックをどの内容で反映済みかは、app_settings（gcal.ota_synced）にハッシュで控える。

const OTA_SETTING_KEY = "gcal.ota_synced";

function otaEventId(blockId) {
  return `mdo${String(blockId).padStart(6, "0")}`;
}

function buildOtaEvent(b) {
  const room = (ROOMS.find((r) => r.resourceId === b.resourceId) || { label: b.resourceId }).label;
  const nights = Math.round((Date.parse(b.endDate) - Date.parse(b.startDate)) / 86400000);
  const lines = [
    `チャネル：${channelLabel(b.channel)}`,
    `部屋：${room}`,
    `日程：${b.startDate} IN 〜 ${b.endDate} OUT（${nights}泊）`,
    b.guestName ? `お客様：${b.guestName}` : null,
    b.guestCount != null ? `人数：${b.guestCount}名` : null,
    b.totalPrice != null ? `金額：${Number(b.totalPrice).toLocaleString("ja-JP")}円` : null,
    b.bookingRef ? `予約番号：${b.bookingRef}` : null,
    b.memo ? `メモ：${b.memo}` : null,
    "※OTAから自動で取り込んだ予約です（お客様の詳細はOTAの管理画面をご確認ください）",
  ].filter(Boolean);
  return {
    id: otaEventId(b.id),
    summary: `[${channelLabel(b.channel)}] ${room}${b.guestName ? ` ${b.guestName}` : ""}`,
    description: lines.join("\n"),
    start: { dateTime: `${b.startDate}T${NIGHT_START}:00`, timeZone: TZ },
    end: { dateTime: `${b.endDate}T${NIGHT_END}:00`, timeZone: TZ },
    colorId: "5",
    status: "confirmed",
  };
}

// ota_blocks の内容をGoogleカレンダーに合わせる（変更分だけ）。例外は投げない。
async function syncOtaBlocks() {
  if (!isConfigured()) return { skipped: true };
  try {
    // listOtaBlocks はエラー時に空配列を返すため、ここでは直接読んで、失敗したら何もしない（全削除の事故を防ぐ）。
    const res = await query("SELECT * FROM ota_blocks ORDER BY id");
    const rows = res.rows.map(toOtaBlock);
    const prevRaw = (await getSettings(OTA_SETTING_KEY))[OTA_SETTING_KEY];
    const prev = prevRaw ? JSON.parse(prevRaw) : {};
    const next = { ...prev };
    const cutoff = addDays(todayStr(), -1);
    let upserted = 0;
    let deleted = 0;
    let failed = 0;

    for (const b of rows) {
      if (b.endDate < cutoff) continue; // 過ぎた泊は、予定を作り直さない
      const ev = buildOtaEvent(b);
      const hash = crypto.createHash("sha1").update(JSON.stringify(ev)).digest("hex");
      if (prev[b.id] === hash) continue;
      let r = await gcal("PUT", `/events/${ev.id}`, ev);
      if (r.status === 404) {
        r = await gcal("POST", "/events", ev);
        if (r.status === 409) r = await gcal("PUT", `/events/${ev.id}`, ev);
      }
      if (r.ok) {
        next[b.id] = hash;
        upserted += 1;
      } else {
        failed += 1;
        console.error(`[googleCalendar] ota block ${b.id} sync failed: ${r.status} ${r.text}`);
      }
    }

    // OTA側でキャンセルされて ota_blocks から消えたものは、予定も削除する
    const present = new Set(rows.map((b) => String(b.id)));
    for (const id of Object.keys(prev)) {
      if (present.has(String(id))) continue;
      const r = await gcal("DELETE", `/events/${otaEventId(id)}`);
      if (r.ok || r.status === 404 || r.status === 410) {
        delete next[id];
        deleted += 1;
      } else {
        failed += 1;
        console.error(`[googleCalendar] ota block ${id} delete failed: ${r.status} ${r.text}`);
      }
    }

    await setSetting(OTA_SETTING_KEY, JSON.stringify(next));
    return { ok: failed === 0, upserted, deleted, failed };
  } catch (e) {
    console.error("[googleCalendar] ota sync failed:", e && e.message);
    return { ok: false, error: e && e.message };
  }
}

module.exports = { isConfigured, syncReservation, syncOtaBlocks, eventId };
