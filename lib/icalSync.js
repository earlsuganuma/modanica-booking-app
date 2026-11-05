// OTA（Booking.com・Airbnb）との iCal 在庫同期。在庫の正は自社システム。
//
// 書き出し（export）: /ical/{チャネル別トークン}/{naka|washitsu}.ics
//   部屋ごとに「埋まっている泊」を終日 VEVENT で出す。埋まり扱い＝キャンセル以外の予約（要確認・確定など。
//   貸切プランは両方の部屋）、私用・予約不可ブロック（その部屋の部屋のみプランを止めているもの）、
//   他チャネルから取り込んだ OTA ブロック。同じチャネルから取り込んだ分は、そのチャネル向けには出さない（エコー防止）。
//   SUMMARY は "Blocked" 固定で、氏名などは一切出さない。
//
// 取り込み（import）: ical_feeds（部屋×チャネルの取得URL）を cron（/api/cron/ical-sync、15分ごと）で取得し、
//   UID をキーに ota_blocks へ保存・更新。取得結果から消えた UID はキャンセルとみなして解除する。
//   取得・解析に失敗したときは既存のブロックに一切触れない。追加・変更・解除・失敗は管理者にメール通知する。
const crypto = require("crypto");
const { query, getPool } = require("./db");
const { buildIcs, parseIcs, nightsOverlapping, mergeNights, addDays } = require("./ical");
const { ROOMS, CHANNELS, roomByResource, channelLabel, listOtaBlocks } = require("./otaBlocks");
const { listBlocks } = require("./privateBlocks");
const { getSettings, setSetting } = require("./appSettings");
const { todayStr } = require("./dateUtil");

const UID_DOMAIN = "booking.modanica.net";
const TOKEN_KEY_PREFIX = "ical.export_token.";
const FETCH_TIMEOUT_MS = 20000;
const MAX_BYTES = 5 * 1024 * 1024;
const FAIL_RENOTIFY_MS = 24 * 3600 * 1000; // 失敗が続くときは24時間ごとに再通知
const LOCK_KEY = 73_510_421; // pg_advisory_lock 用（同時実行の防止）

// ---------- 書き出しトークン ----------

function newToken() {
  return crypto.randomBytes(24).toString("base64url");
}

// チャネルごとのトークン。未発行のチャネルは発行して保存する。
async function getExportTokens({ create = true } = {}) {
  const s = await getSettings(TOKEN_KEY_PREFIX);
  const out = {};
  for (const c of CHANNELS) {
    let t = s[TOKEN_KEY_PREFIX + c.id];
    if (!t && create) {
      t = newToken();
      await setSetting(TOKEN_KEY_PREFIX + c.id, t);
    }
    out[c.id] = t || null;
  }
  return out;
}

async function regenerateToken(channel) {
  if (!CHANNELS.some((c) => c.id === channel)) throw new Error("unknown channel");
  const t = newToken();
  await setSetting(TOKEN_KEY_PREFIX + channel, t);
  return t;
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// URL のトークンからチャネルを特定する（一致しなければ null）
async function channelForToken(token) {
  if (!token || token.length < 20) return null;
  const tokens = await getExportTokens({ create: false });
  for (const c of CHANNELS) {
    if (tokens[c.id] && safeEqual(tokens[c.id], token)) return c.id;
  }
  return null;
}

// ---------- 書き出し ----------

// 部屋のみプラン（exclusivity = room）のうち、その部屋を使うもののID
async function roomOnlyPlanIds(resourceId) {
  const res = await query(
    `SELECT p.id FROM plans p JOIN plan_resources pr ON pr.plan_id = p.id
     WHERE p.exclusivity = 'room' AND pr.resource_id = $1`,
    [resourceId]
  );
  return res.rows.map((r) => r.id);
}

/**
 * ある部屋の「埋まっている泊」を、連続範囲にまとめて返す。
 * @param {string} resourceId
 * @param {string|null} forChannel 書き出し先チャネル（そのチャネルから取り込んだ OTA ブロックは除く）
 */
async function occupiedRanges(resourceId, forChannel, { today = todayStr() } = {}) {
  const nights = [];
  const from = addDays(today, -1);

  // 予約（キャンセル以外すべて＝要確認・確定・来店済みなど）。start/end は壁時計時刻（UTC として保存）。
  const rres = await query(
    `SELECT to_char(start_datetime AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI') AS s,
            to_char(end_datetime AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI') AS e
       FROM reservations
      WHERE status <> 'cancelled' AND resource_ids ? $1
        AND end_datetime > ($2::date)::timestamp AT TIME ZONE 'UTC'`,
    [resourceId, from]
  );
  for (const r of rres.rows) nights.push(...nightsOverlapping(r.s, r.e));

  // 私用・予約不可：その部屋の部屋のみプランを止めているもの（対象プラン指定なし＝全プランも含む）
  const roomPlans = await roomOnlyPlanIds(resourceId);
  for (const b of await listBlocks()) {
    const applies = !b.planIds.length || b.planIds.some((id) => roomPlans.includes(id));
    if (applies && b.endDatetime > from) nights.push(...nightsOverlapping(b.startDatetime, b.endDatetime));
  }

  // 他チャネルから取り込んだ OTA ブロック
  for (const b of await listOtaBlocks({ fromDate: from })) {
    if (b.resourceId !== resourceId) continue;
    if (forChannel && b.channel === forChannel) continue;
    nights.push(...nightsOverlapping(b.startDatetime, b.endDatetime));
  }

  return mergeNights(nights.filter((d) => d >= today));
}

async function buildExportIcs(slug, channel, opts = {}) {
  const room = ROOMS.find((r) => r.slug === slug);
  if (!room) return null;
  const ranges = await occupiedRanges(room.resourceId, channel, opts);
  return buildIcs({
    calName: `MODANICA ${room.slug}`,
    uidDomain: UID_DOMAIN,
    events: ranges.map((r) => ({
      uid: `${room.slug}-${r.start.replace(/-/g, "")}-${r.end.replace(/-/g, "")}`,
      start: r.start,
      end: r.end,
      summary: "Blocked",
    })),
    now: opts.now,
  });
}

// ---------- 取り込みURL（ical_feeds） ----------

function toFeed(r) {
  const iso = (v) => (v instanceof Date ? v.toISOString() : v || null);
  return {
    id: r.id,
    resourceId: r.resource_id,
    channel: r.channel,
    importUrl: r.import_url,
    lastFetchedAt: iso(r.last_fetched_at),
    lastSuccessAt: iso(r.last_success_at),
    lastStatus: r.last_status,
    lastError: r.last_error,
    lastEventCount: r.last_event_count,
    failCount: r.fail_count,
  };
}

async function listFeeds() {
  try {
    const res = await query("SELECT * FROM ical_feeds ORDER BY resource_id, channel");
    return res.rows.map(toFeed);
  } catch (e) {
    if (e && e.code === "42P01") return [];
    throw e;
  }
}

function validateImportUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch (e) {
    return "URLの形式が正しくありません。";
  }
  if (u.protocol !== "https:") return "https:// で始まるURLを入力してください。";
  if (u.hostname === "booking.modanica.net") return "自社の書き出しURLは登録できません（Booking.com・Airbnb 側の書き出しURLを入力してください）。";
  return null;
}

// URL を保存（空なら登録解除＝その取り込み分のブロックも削除）
async function saveFeed({ resourceId, channel, importUrl }) {
  if (!roomByResource(resourceId)) throw new Error("unknown room");
  if (!CHANNELS.some((c) => c.id === channel)) throw new Error("unknown channel");
  const url = String(importUrl || "").trim();
  if (!url) {
    await query("DELETE FROM ical_feeds WHERE resource_id = $1 AND channel = $2", [resourceId, channel]);
    return null;
  }
  const res = await query(
    `INSERT INTO ical_feeds (resource_id, channel, import_url) VALUES ($1, $2, $3)
     ON CONFLICT (resource_id, channel) DO UPDATE
       SET import_url = EXCLUDED.import_url,
           last_status = CASE WHEN ical_feeds.import_url = EXCLUDED.import_url THEN ical_feeds.last_status ELSE NULL END,
           last_error = CASE WHEN ical_feeds.import_url = EXCLUDED.import_url THEN ical_feeds.last_error ELSE NULL END,
           fail_count = CASE WHEN ical_feeds.import_url = EXCLUDED.import_url THEN ical_feeds.fail_count ELSE 0 END
     RETURNING *`,
    [resourceId, channel, url]
  );
  return toFeed(res.rows[0]);
}

// ---------- 取得・反映 ----------

async function fetchIcs(url, fetchImpl = fetch) {
  const res = await fetchImpl(url, {
    headers: { "User-Agent": "MODANICA-iCal-Sync/1.0 (+https://booking.modanica.net)", Accept: "text/calendar, */*" },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.kind = "fetch";
    throw err;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) {
    const err = new Error(`応答が大きすぎます（${buf.length} bytes）`);
    err.kind = "fetch";
    throw err;
  }
  return buf.toString("utf8");
}

/**
 * 1フィードを取得・反映する。失敗時は ota_blocks に触れない。
 * @returns {{ feed, ok, kind?, error?, added: [], changed: [], removed: [] }}
 */
async function syncFeed(feed, { fetchImpl, today = todayStr() } = {}) {
  const result = { feed, ok: false, added: [], changed: [], removed: [] };
  let text;
  try {
    text = await fetchIcs(feed.importUrl, fetchImpl);
  } catch (e) {
    result.kind = "fetch";
    const cause = e && e.cause && (e.cause.code || e.cause.message);
    result.error =
      e && e.name === "TimeoutError" ? "タイムアウト（20秒）" : `${String((e && e.message) || e)}${cause ? `（${cause}）` : ""}`;
    return result;
  }
  let events;
  try {
    events = parseIcs(text).events;
  } catch (e) {
    result.kind = "parse";
    result.error = String((e && e.message) || e);
    return result;
  }

  // 終わった泊（チェックアウト日が今日以前）は対象外。キャンセル（STATUS:CANCELLED）も除く。
  const incoming = new Map();
  for (const ev of events) {
    if (ev.cancelled || ev.end <= today) continue;
    incoming.set(ev.uid, ev);
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query("SELECT * FROM ota_blocks WHERE feed_id = $1 FOR UPDATE", [feed.id]);
    const existing = new Map(cur.rows.map((r) => [r.uid, r]));

    for (const [uid, ev] of incoming) {
      const old = existing.get(uid);
      if (!old) {
        await client.query(
          `INSERT INTO ota_blocks (feed_id, resource_id, channel, uid, start_date, end_date, summary)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [feed.id, feed.resourceId, feed.channel, uid, ev.start, ev.end, ev.summary]
        );
        result.added.push({ uid, start: ev.start, end: ev.end, summary: ev.summary });
      } else if (old.start_date !== ev.start || old.end_date !== ev.end || old.summary !== ev.summary) {
        await client.query(
          "UPDATE ota_blocks SET start_date = $2, end_date = $3, summary = $4, updated_at = now() WHERE id = $1",
          [old.id, ev.start, ev.end, ev.summary]
        );
        if (old.start_date !== ev.start || old.end_date !== ev.end) {
          result.changed.push({ uid, start: ev.start, end: ev.end, oldStart: old.start_date, oldEnd: old.end_date });
        }
      }
    }
    for (const [uid, old] of existing) {
      if (incoming.has(uid)) continue;
      // 終わった泊（チェックアウト日が今日以前）は、OTA側の書き出しから消えても、記録として残す
      // （お客様名・金額・来店済みの記録・名簿との紐づけが、チェックアウトの日に消えないように）。
      if (old.end_date <= today) continue;
      // まだ先の泊が消えた＝OTA側でキャンセル。ブロックを削除して、売り止めを解除する
      await client.query("DELETE FROM ota_blocks WHERE id = $1", [old.id]);
      result.removed.push({ uid, start: old.start_date, end: old.end_date });
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    result.kind = "db";
    result.error = String((e && e.message) || e);
    return result;
  } finally {
    client.release();
  }
  result.ok = true;
  result.eventCount = incoming.size;
  return result;
}

async function recordFeedStatus(feed, r) {
  if (r.ok) {
    await query(
      `UPDATE ical_feeds SET last_fetched_at = now(), last_success_at = now(), last_status = 'ok',
         last_error = NULL, last_event_count = $2, fail_count = 0, fail_notified_at = NULL WHERE id = $1`,
      [feed.id, r.eventCount]
    );
  } else {
    await query(
      `UPDATE ical_feeds SET last_fetched_at = now(), last_status = $2, last_error = $3, fail_count = fail_count + 1 WHERE id = $1`,
      [feed.id, r.kind === "parse" ? "parse_error" : "fetch_error", String(r.error).slice(0, 1000)]
    );
  }
}

// 失敗の通知は「初回」と「24時間ごと」だけ（15分ごとに同じメールが届かないように）。復旧したときも1回知らせる。
async function shouldNotifyFailure(feedId) {
  const res = await query("SELECT fail_notified_at FROM ical_feeds WHERE id = $1", [feedId]);
  const at = res.rows[0] && res.rows[0].fail_notified_at;
  return !at || Date.now() - new Date(at).getTime() >= FAIL_RENOTIFY_MS;
}

// ---------- 通知 ----------

function fmtRange(start, end) {
  const n = Math.round((Date.parse(end) - Date.parse(start)) / 86400000);
  return `${start}（IN）〜 ${end}（OUT）${n}泊`;
}

function buildNoticeText(items, baseUrl) {
  const lines = ["OTA（Booking.com・Airbnb）とのカレンダー同期で、次の変化がありました。", ""];
  for (const it of items) {
    const room = roomByResource(it.feed.resourceId);
    const head = `■ ${channelLabel(it.feed.channel)} ／ ${room ? room.label : it.feed.resourceId}`;
    lines.push(head);
    if (it.failure) {
      lines.push(`  ${it.failure.kind === "parse" ? "解析失敗" : it.failure.kind === "db" ? "保存失敗" : "取得失敗"}：${it.failure.error}`);
      lines.push("  ※ 既存の売り止め（OTAブロック）はそのまま維持しています。");
      if (it.failure.failCount > 1) lines.push(`  ※ ${it.failure.failCount}回連続で失敗しています。`);
    }
    if (it.recovered) lines.push("  取得が復旧しました。");
    for (const a of it.added) lines.push(`  ＋ 売り止め追加：${fmtRange(a.start, a.end)}${a.summary ? `（${a.summary}）` : ""}`);
    for (const c of it.changed) lines.push(`  ↻ 日程変更：${fmtRange(c.oldStart, c.oldEnd)} → ${fmtRange(c.start, c.end)}`);
    for (const r of it.removed) lines.push(`  － 売り止め解除（OTA側でキャンセル）：${fmtRange(r.start, r.end)}`);
    lines.push("");
  }
  lines.push("同じ日の貸切プラン（BBQ＋宿泊・飲み会＋宿泊・女子会）も、売り止めの部屋がある泊は自社サイトで予約できません。");
  if (baseUrl) lines.push("", `管理画面：${baseUrl.replace(/\/$/, "")}/admin/ical`);
  return lines.join("\n");
}

// メール送信。lib/mailer.js の sendMail はログ保存のたびに全テーブルを読み直して書き戻す（load/save）ため、
// 無人で動く cron からは使わず、Resend に直接送り、mail_log には1行だけ INSERT する。
async function sendAdminNotice({ subject, text }) {
  const to = process.env.ADMIN_NOTIFY_EMAIL || "";
  const key = process.env.RESEND_API_KEY || "";
  const from = process.env.MAIL_FROM || "MODANICA <onboarding@resend.dev>";
  let status = "logged";
  let error = null;
  if (!to) {
    status = "failed";
    error = "ADMIN_NOTIFY_EMAIL が未設定です";
  } else if (key) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: to.split(",").map((s) => s.trim()).filter(Boolean), subject, text }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) status = "sent";
      else {
        status = "failed";
        error = `HTTP ${res.status}: ${await res.text().catch(() => "")}`;
      }
    } catch (e) {
      status = "failed";
      error = String((e && e.message) || e);
    }
  }
  try {
    const c = await query(
      "UPDATE counters SET value = value + 1 WHERE name = 'nextMailLogId' RETURNING value - 1 AS id"
    );
    const id = c.rows[0] ? c.rows[0].id : null;
    if (id) {
      await query(
        `INSERT INTO mail_log (id, type, "to", subject, body, status, error) VALUES ($1, 'ical_sync', $2, $3, $4, $5, $6)`,
        [id, to, subject, text, status, error]
      );
    }
  } catch (e) {
    console.error("ical notice log failed:", e.message);
  }
  return { status, error };
}

// ---------- 取り込みURLの件数の見張り ----------
// 取り込みURLが知らないうちに消えると、OTA の予約が自社側で売り止めされない（2026-11-02 に実際に起きた）。
// 同期のたびに件数を前回と比べ、減っていたら警告する。0件のときも警告する（24時間に1回まで）。
const FEED_COUNT_KEY = "ical.last_feed_count";
const ZERO_WARNED_KEY = "ical.zero_feed_warned_at";
const ZERO_WARN_INTERVAL_MS = 24 * 3600 * 1000;

async function checkFeedCount(feeds) {
  const s = await getSettings("ical.");
  const prev = s[FEED_COUNT_KEY] !== undefined ? Number(s[FEED_COUNT_KEY]) : null;
  const now = feeds.length;
  const lines = [];
  let kind = null;
  if (prev !== null && now < prev) {
    kind = "decreased";
    lines.push(`OTA取り込みURLの登録数が ${prev}件 → ${now}件 に減りました。`);
  } else if (now === 0) {
    const at = s[ZERO_WARNED_KEY] ? Date.parse(s[ZERO_WARNED_KEY]) : 0;
    if (!at || Date.now() - at >= ZERO_WARN_INTERVAL_MS) kind = "zero";
  }
  if (now === 0 && kind) {
    if (kind === "zero") lines.push("OTA取り込みURLが1件も登録されていません。");
    await setSetting(ZERO_WARNED_KEY, new Date().toISOString());
  }
  if (prev !== now) await setSetting(FEED_COUNT_KEY, now);
  if (!kind) return null;

  const registered = feeds.map((f) => {
    const room = roomByResource(f.resourceId);
    return `  ・${channelLabel(f.channel)} ／ ${room ? room.label : f.resourceId}`;
  });
  const text = [
    ...lines,
    "",
    "このままでは Booking.com・Airbnb の予約が自社サイトで売り止めされず、ダブルブッキングになるおそれがあります。",
    "管理画面の「OTA連携」で取り込みURLを確認し、必要なら登録し直してください（意図して登録を解除した場合は対応不要です）。",
    "",
    "現在登録されている取り込みURL：",
    ...(registered.length ? registered : ["  （なし）"]),
    ...(process.env.ADMIN_BASE_URL ? ["", `管理画面：${process.env.ADMIN_BASE_URL.replace(/\/$/, "")}/admin/ical`] : []),
  ].join("\n");
  const subject =
    kind === "zero" ? "【MODANICA・要確認】OTA取り込みURLが0件です" : `【MODANICA・要確認】OTA取り込みURLが減りました（${prev}→${now}件）`;
  const mail = await sendAdminNotice({ subject, text });
  return { kind, prev, now, mail: mail.status };
}

// ---------- 全体の実行 ----------

/**
 * 登録済みの全フィードを取得・反映する（cron・管理画面の「今すぐ取得」から呼ぶ）。
 * 同時に2つ走らないよう advisory lock を取る。
 */
async function runIcalSync({ notify = true, fetchImpl, today } = {}) {
  const lockClient = await getPool().connect();
  let locked = false;
  try {
    const lr = await lockClient.query("SELECT pg_try_advisory_lock($1) AS ok", [LOCK_KEY]);
    locked = !!lr.rows[0].ok;
    if (!locked) return { ok: true, skipped: "already_running", feeds: [] };

    const feeds = (await listFeeds()).filter((f) => f.importUrl);
    const feedWarning = notify ? await checkFeedCount(feeds) : null;
    const summary = [];
    const noticeItems = [];
    for (const feed of feeds) {
      const prevFailCount = feed.failCount || 0;
      const r = await syncFeed(feed, { fetchImpl, today });
      await recordFeedStatus(feed, r);
      const item = { feed, added: r.added, changed: r.changed, removed: r.removed };
      let notifyThis = r.added.length + r.changed.length + r.removed.length > 0;
      if (!r.ok) {
        if (await shouldNotifyFailure(feed.id)) {
          item.failure = { kind: r.kind, error: r.error, failCount: prevFailCount + 1 };
          notifyThis = true;
          if (notify) await query("UPDATE ical_feeds SET fail_notified_at = now() WHERE id = $1", [feed.id]);
        }
      } else if (prevFailCount > 0) {
        item.recovered = true;
        notifyThis = true;
      }
      if (notifyThis) noticeItems.push(item);
      summary.push({
        resourceId: feed.resourceId,
        channel: feed.channel,
        ok: r.ok,
        kind: r.kind || null,
        error: r.error || null,
        events: r.eventCount ?? null,
        added: r.added.length,
        changed: r.changed.length,
        removed: r.removed.length,
      });
    }

    let mail = null;
    if (noticeItems.length) {
      const hasFail = noticeItems.some((i) => i.failure);
      const counts = noticeItems.reduce(
        (a, i) => ({ add: a.add + i.added.length, rm: a.rm + i.removed.length, ch: a.ch + i.changed.length }),
        { add: 0, rm: 0, ch: 0 }
      );
      const parts = [];
      if (counts.add) parts.push(`追加${counts.add}`);
      if (counts.ch) parts.push(`変更${counts.ch}`);
      if (counts.rm) parts.push(`解除${counts.rm}`);
      if (hasFail) parts.push("取得失敗");
      if (!parts.length) parts.push("復旧");
      const subject = `【MODANICA】OTAカレンダー同期：${parts.join("・")}`;
      const text = buildNoticeText(noticeItems, process.env.ADMIN_BASE_URL);
      mail = notify ? await sendAdminNotice({ subject, text }) : { status: "dry_run", subject, text };
    }
    return { ok: true, feeds: summary, mail, feedWarning };
  } finally {
    if (locked) await lockClient.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
    lockClient.release();
  }
}

module.exports = {
  getExportTokens,
  regenerateToken,
  channelForToken,
  occupiedRanges,
  buildExportIcs,
  listFeeds,
  saveFeed,
  validateImportUrl,
  syncFeed,
  runIcalSync,
  buildNoticeText,
};
