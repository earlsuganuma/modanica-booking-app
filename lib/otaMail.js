// Booking.com の通知メールを読み取り、OTA予約（ota_blocks）にゲスト名・予約番号・ゲストからのメッセージを自動で入れる。
//
// 受信: さくらのメールボックス（booking@modanica.net）を IMAP で読む（読み取り専用。メールは消さない・既読にしない）。
//   環境変数 OTA_MAIL_IMAP_HOST / OTA_MAIL_USER / OTA_MAIL_PASSWORD（任意で OTA_MAIL_IMAP_PORT。既定 993）。未設定なら何もしない。
// 対象: 送信元に booking.com を含むメール。件名または本文から、次を読み取る。
//   予約番号 / 宿泊者名 / チェックイン日・チェックアウト日 / ゲストからのメッセージ。
// 人数・金額・部屋名は、これまでのBooking.comの通知メールには載っていないため、読み取らない（手入力）。
//
// 原則:
//   ・すでに入力されている項目は上書きしない（空欄だけ埋める）。手入力が常に優先。
//   ・どの予約の泊か特定できないとき（該当なし・複数該当）は何もしない。次回の実行でもう一度試す。
//   ・処理済みのメールは app_settings（otamail.processed）に記録し、同じメールを二重に取り込まない。
const { query } = require("./db");
const { getSettings, setSetting } = require("./appSettings");
const { listOtaBlocks } = require("./otaBlocks");
const { todayStr } = require("./dateUtil");
const { addDays } = require("./ical");

const PROCESSED_KEY = "otamail.processed";
const LOOKBACK_DAYS = 45;
const MAX_MESSAGES = 150;
const MAX_PROCESSED = 600;

function isConfigured() {
  return !!(process.env.OTA_MAIL_IMAP_HOST && process.env.OTA_MAIL_USER && process.env.OTA_MAIL_PASSWORD);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}
function ymd(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function normalize(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ 　]/g, " ")
    .replace(/[ \t]+/g, " ");
}

// 1通のメールから読み取れる項目を返す。読み取れた項目だけが入る。予約番号が無ければ null。
function parseBookingEmail({ subject = "", text = "", from = "" } = {}) {
  if (!/booking\.com/i.test(from)) return null;
  const subj = normalize(subject);
  const body = normalize(text);
  // キャンセル・変更の通知は、予約内容として取り込まない（今は対象外）
  if (/キャンセル|取り消し|cancel/i.test(subj)) return null;

  const out = { bookingRef: "", guestName: "", checkIn: "", checkOut: "", message: "" };

  // 予約番号
  let m = subj.match(/[（(]\s*(\d{8,12})\s*[,、，]/) || body.match(/予約番号\s*[:：]?\s*(\d{8,12})/) || subj.match(/\b(\d{9,12})\b/);
  if (m) out.bookingRef = m[1];
  if (!out.bookingRef) return null;

  // チェックイン／アウト（本文の「予約の詳細」優先。無ければ件名の日付＝到着日）
  const dateRe = (label) => new RegExp(`${label}\\s*[:：]?\\s*(\\d{4})年\\s*(\\d{1,2})月\\s*(\\d{1,2})日`);
  m = body.match(dateRe("チェックイン"));
  if (m) out.checkIn = ymd(m[1], m[2], m[3]);
  m = body.match(dateRe("チェックアウト"));
  if (m) out.checkOut = ymd(m[1], m[2], m[3]);
  if (!out.checkIn) {
    m = subj.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
    if (m) out.checkIn = ymd(m[1], m[2], m[3]);
  }

  // ゲスト名
  m = body.match(/宿泊者氏名\s*[:：]?\s*([^\n]+)/);
  if (m) out.guestName = m[1].trim();
  if (!out.guestName) {
    m = body.match(/(?:たった今、?\s*)?([^\n、。]+?)様から(?:、貴施設の[^\n]*?)?(?:新しい)?予約がありました/);
    if (m) out.guestName = m[1].trim();
  }
  if (!out.guestName) {
    m = subj.match(/^(.+?)様からメッセージが届きました/);
    if (m) out.guestName = m[1].trim();
  }

  // ゲストからのメッセージ（選択肢ボタンの文言の手前まで）
  m = body.match(/様のメッセージ\s*[:：]\s*\n?([\s\S]*?)(?:\n\s*(?:無料で手配|有料で手配|利用状況次第|手配不可|その他|予約の詳細)|$)/);
  if (m) {
    // メール末尾の「返信」ボタン部分（「返信」行・「-->」・長いリンク）は、ゲストの文章ではないので外す
    let msg = m[1].split(/\n\s*(?:返信|Reply)\s*(?:\n|$)|-->|https?:\/\/\S*booking\.com/i)[0];
    msg = msg.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    out.message = msg.slice(0, 800);
  }

  // 名前・日付・メッセージのどれも読めないなら、取り込む意味がない
  if (!out.guestName && !out.checkIn && !out.message) return null;
  return out;
}

// 読み取った内容に合う OTA ブロックを1件だけ探す。特定できなければ null。
function findBlock(blocks, p) {
  const booking = blocks.filter((b) => b.channel === "booking");
  const byRef = booking.filter((b) => b.bookingRef && b.bookingRef === p.bookingRef);
  if (byRef.length === 1) return byRef[0];
  if (byRef.length > 1 || !p.checkIn) return null;
  const cands = booking.filter(
    (b) => b.startDate === p.checkIn && (!p.checkOut || b.endDate === p.checkOut) && (!b.bookingRef || b.bookingRef === p.bookingRef)
  );
  return cands.length === 1 ? cands[0] : null;
}

function fmtDateTime(d) {
  const x = new Date(d);
  if (isNaN(x.getTime())) return "";
  const jst = new Date(x.getTime() + 9 * 3600 * 1000);
  return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()} ${pad2(jst.getUTCHours())}:${pad2(jst.getUTCMinutes())}`;
}

// ブロックに反映する。空欄だけ埋め、メッセージはメモの末尾に追記する。変更があれば true。
async function applyToBlock(block, p, receivedAt) {
  const sets = [];
  const vals = [block.id];
  const add = (col, v) => {
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  };
  if (!block.bookingRef && p.bookingRef) add("booking_ref", p.bookingRef);
  if (!block.guestName && p.guestName) add("guest_name", p.guestName.slice(0, 100));
  if (p.message && !String(block.memo).includes(p.message)) {
    const line = `【ゲストからのメッセージ ${fmtDateTime(receivedAt)}】${p.message}`;
    add("memo", (block.memo ? block.memo + "\n" : "") + line);
  }
  if (!sets.length) return false;
  await query(`UPDATE ota_blocks SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`, vals);
  return true;
}

async function fetchRecentMails() {
  // 未インストール・未設定でも、他の処理（iCal同期など）に影響しないよう、使うときに読み込む
  const { ImapFlow } = require("imapflow");
  const { simpleParser } = require("mailparser");
  const client = new ImapFlow({
    host: process.env.OTA_MAIL_IMAP_HOST,
    port: Number(process.env.OTA_MAIL_IMAP_PORT || 993),
    secure: true,
    auth: { user: process.env.OTA_MAIL_USER, pass: process.env.OTA_MAIL_PASSWORD },
    logger: false,
  });
  const mails = [];
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX", { readOnly: true });
    try {
      const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600 * 1000);
      let uids = (await client.search({ since, from: "booking.com" }, { uid: true })) || [];
      uids = uids.sort((a, b) => b - a).slice(0, MAX_MESSAGES);
      if (uids.length) {
        for await (const msg of client.fetch(uids, { source: true, uid: true }, { uid: true })) {
          try {
            const parsed = await simpleParser(msg.source);
            const fromText = (parsed.from && parsed.from.text) || "";
            mails.push({
              id: parsed.messageId || `uid:${msg.uid}`,
              subject: parsed.subject || "",
              from: fromText,
              date: parsed.date || new Date(),
              text: parsed.text || (parsed.html ? String(parsed.html).replace(/<[^>]+>/g, "\n") : ""),
            });
          } catch (e) {
            console.error("otaMail: parse failed:", e.message);
          }
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return mails;
}

// メールを読んで OTA予約に反映する。cron（15分ごと）と管理画面の「今すぐ同期」から呼ぶ。
async function ingestOtaMail() {
  if (!isConfigured()) return { skipped: "not_configured" };
  let mails;
  try {
    mails = await fetchRecentMails();
  } catch (e) {
    // imapflow のエラーは message が「Command failed」だけのことがあるため、原因が分かる項目も出す（パスワードは含まれない）
    const detail = [e.responseText, e.serverResponseCode, e.authenticationFailed ? "認証失敗" : "", e.code].filter(Boolean).join(" / ");
    console.error("otaMail: fetch failed:", e.message, detail ? `(${detail})` : "");
    return { ok: false, error: String(e.message || e) + (detail ? ` (${detail})` : "") };
  }
  const s = await getSettings(PROCESSED_KEY);
  let processed = [];
  try {
    processed = JSON.parse(s[PROCESSED_KEY] || "[]");
  } catch (e) {
    processed = [];
  }
  const done = new Set(processed);
  const blocks = await listOtaBlocks({ fromDate: addDays(todayStr(), -LOOKBACK_DAYS) });

  const result = { ok: true, mails: mails.length, applied: 0, unmatched: 0 };
  // 古いメールから順に反映（メッセージは届いた順にメモへ追記される）
  mails.sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const mail of mails) {
    if (done.has(mail.id)) continue;
    const p = parseBookingEmail(mail);
    if (!p) {
      done.add(mail.id); // 予約と無関係なメール（宣伝・キャンセル等）は、次回以降スキップ
      continue;
    }
    const block = findBlock(blocks, p);
    if (!block) {
      result.unmatched++; // iCal がまだ届いていない等。次回もう一度試す
      continue;
    }
    try {
      if (await applyToBlock(block, p, mail.date)) result.applied++;
      // 同じ実行内の後続メールが最新の値を見られるよう、メモリ上のブロックも更新
      const fresh = await listOtaBlocks({ fromDate: addDays(todayStr(), -LOOKBACK_DAYS) });
      blocks.length = 0;
      blocks.push(...fresh);
      done.add(mail.id);
    } catch (e) {
      console.error("otaMail: apply failed:", e.message);
    }
  }
  await setSetting(PROCESSED_KEY, JSON.stringify([...done].slice(-MAX_PROCESSED)));
  return result;
}

module.exports = { isConfigured, parseBookingEmail, findBlock, ingestOtaMail };
