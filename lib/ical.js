// iCalendar（RFC 5545）の最小限の生成・解析と、「泊」の計算（DB に触れない純粋関数のみ）。
// OTA（Booking.com・Airbnb）との在庫同期（lib/icalSync.js）から使う。
//
// 「泊」の考え方：日付 D の泊＝部屋のみプラン（stay_16_11）の D 16:00 〜 D+1 11:00。
// 予約・私用ブロックなどの時間帯がこの範囲と重なれば、その泊は埋まっている（＝自社サイトでも
// 部屋のみプランがその泊を受け付けない）とみなす。日時はすべてタイムゾーンなしの壁時計 "YYYY-MM-DDTHH:MM"。

const NIGHT_START = "16:00";
const NIGHT_END = "11:00";

function pad2(n) {
  return String(n).padStart(2, "0");
}

// "YYYY-MM-DD" に n 日足す（ローカル日付のまま計算する）
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

// 泊 D の時間帯
function nightWindow(date) {
  return { start: `${date}T${NIGHT_START}`, end: `${addDays(date, 1)}T${NIGHT_END}` };
}

// 時間帯 [start, end) と重なる泊の日付（YYYY-MM-DD）の配列
function nightsOverlapping(start, end) {
  if (!start || !end || end <= start) return [];
  const out = [];
  let d = addDays(start.slice(0, 10), -1);
  const last = end.slice(0, 10);
  for (let i = 0; d <= last && i < 800; i += 1) {
    const w = nightWindow(d);
    if (start < w.end && end > w.start) out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

// 泊の日付の集合を、連続する範囲 [{ start: チェックイン日, end: チェックアウト日 }] にまとめる
function mergeNights(nights) {
  const sorted = [...new Set(nights)].sort();
  const ranges = [];
  for (const d of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && last.end === d) last.end = addDays(d, 1);
    else ranges.push({ start: d, end: addDays(d, 1) });
  }
  return ranges;
}

// ---------- 生成 ----------

function escapeText(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// 75オクテットごとに折り返す（RFC 5545 3.1）。マルチバイト文字の途中では切らない。
function foldLine(line) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts = [];
  let cur = "";
  let curLen = 0;
  let limit = 75;
  for (const ch of line) {
    const len = Buffer.byteLength(ch, "utf8");
    if (curLen + len > limit) {
      parts.push(cur);
      cur = "";
      curLen = 0;
      limit = 74; // 続きの行は先頭の空白1文字ぶん短い
    }
    cur += ch;
    curLen += len;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

function icsDate(dateStr) {
  return dateStr.replace(/-/g, "");
}

function icsStamp(d = new Date()) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * 終日イベントだけの VCALENDAR を作る。
 * @param {{ calName: string, uidDomain: string, events: { uid: string, start: string, end: string, summary: string }[], now?: Date }} p
 */
function buildIcs({ calName, uidDomain, events, now = new Date() }) {
  const stamp = icsStamp(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MODANICA//booking.modanica.net//JA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calName)}`,
  ];
  // RFC 5545 では VCALENDAR に1つ以上のコンポーネントが必要。埋まっている泊が1つもないときは、
  // OTA が無視する過去日（2000-01-01）のイベントを1件だけ入れて、厳密な検証でも正しい形式にする。
  const list = events.length
    ? events
    : [{ uid: "placeholder-20000101", start: "2000-01-01", end: "2000-01-02", summary: "Blocked" }];
  for (const e of list) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@${uidDomain}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(e.start)}`,
      `DTEND;VALUE=DATE:${icsDate(e.end)}`,
      `SUMMARY:${escapeText(e.summary)}`,
      "TRANSP:OPAQUE",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

// ---------- 解析 ----------

class IcsParseError extends Error {}

function unescapeText(s) {
  return String(s).replace(/\\([\\;,nN])/g, (_, c) => (c === "n" || c === "N" ? "\n" : c));
}

// "DTSTART;VALUE=DATE:20261105" → { name, params, value }
function parseLine(line) {
  // 値の中の ":" を誤って区切りにしないよう、引用符の外にある最初の ":" で分ける
  let inQuote = false;
  let idx = -1;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ":" && !inQuote) {
      idx = i;
      break;
    }
  }
  if (idx < 0) return null;
  const head = line.slice(0, idx);
  const value = line.slice(idx + 1);
  const [name, ...paramParts] = head.split(";");
  const params = {};
  for (const p of paramParts) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value };
}

// DTSTART/DTEND の値を "YYYY-MM-DD"（日本時間の日付）に。解釈できなければ null。
function toDate(prop) {
  if (!prop) return null;
  const v = prop.value.trim();
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(v);
  if (!m) return null;
  if (m[7] === "Z") {
    // UTC → 日本時間（+9時間）の日付
    const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) + 9 * 3600 * 1000;
    const d = new Date(t);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  // TZID 付き・フローティング時刻：その土地の日付をそのまま使う（OTA の宿泊は終日イベントが基本）
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function isValidDate(s) {
  if (!s) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * ICS テキストを解析する。形式が壊れている場合は IcsParseError を投げる（呼び出し側は既存ブロックを消さない）。
 * @returns {{ events: { uid: string, start: string, end: string, summary: string, cancelled: boolean }[] }}
 */
function parseIcs(text) {
  if (typeof text !== "string") throw new IcsParseError("本文がありません");
  const body = text.replace(/^\uFEFF/, "");
  // 行の折り返し（CRLF＋空白/タブ）を戻す
  const lines = body.replace(/\r\n|\r/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const trimmed = lines.map((l) => l.trimEnd()).filter((l) => l !== "");
  if (!trimmed.length || trimmed[0].toUpperCase() !== "BEGIN:VCALENDAR") {
    throw new IcsParseError("BEGIN:VCALENDAR で始まっていません（iCalendar ではない応答）");
  }
  if (!trimmed.some((l) => l.toUpperCase() === "END:VCALENDAR")) {
    throw new IcsParseError("END:VCALENDAR がありません（途中で切れている可能性）");
  }

  const events = [];
  const seen = new Map();
  let cur = null;
  let depth = 0; // VEVENT の中の VALARM などを読み飛ばす
  for (const raw of trimmed) {
    const upper = raw.toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      if (cur) throw new IcsParseError("VEVENT が閉じられていません");
      cur = {};
      depth = 0;
      continue;
    }
    if (!cur) continue;
    if (upper.startsWith("BEGIN:")) {
      depth += 1;
      continue;
    }
    if (upper.startsWith("END:") && upper !== "END:VEVENT") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (upper === "END:VEVENT") {
      const start = toDate(cur.DTSTART);
      if (!isValidDate(start)) throw new IcsParseError(`DTSTART を解釈できません（UID: ${cur.UID ? cur.UID.value : "なし"}）`);
      let end = toDate(cur.DTEND);
      if (cur.DTEND && !isValidDate(end)) throw new IcsParseError(`DTEND を解釈できません（UID: ${cur.UID ? cur.UID.value : "なし"}）`);
      if (!end && cur.DURATION) {
        const dm = /^P(?:(\d+)W)?(?:(\d+)D)?/.exec(cur.DURATION.value.trim());
        const days = dm ? (+(dm[1] || 0)) * 7 + (+(dm[2] || 0)) : 0;
        if (days > 0) end = addDays(start, days);
      }
      if (!end || end <= start) end = addDays(start, 1); // 終了なし・同日は1泊扱い（RFC 5545: 終日は1日）
      let uid = cur.UID ? cur.UID.value.trim() : "";
      if (!uid) uid = `nouid-${start}-${end}`;
      if (seen.has(uid)) uid = `${uid}#${start}`;
      seen.set(uid, true);
      const status = cur.STATUS ? cur.STATUS.value.trim().toUpperCase() : "";
      events.push({
        uid: uid.slice(0, 500),
        start,
        end,
        summary: cur.SUMMARY ? unescapeText(cur.SUMMARY.value).slice(0, 200) : "",
        cancelled: status === "CANCELLED",
      });
      cur = null;
      continue;
    }
    if (depth > 0) continue;
    const p = parseLine(raw);
    if (p && !cur[p.name]) cur[p.name] = p;
  }
  if (cur) throw new IcsParseError("VEVENT が閉じられていません");
  return { events };
}

module.exports = {
  addDays,
  nightWindow,
  nightsOverlapping,
  mergeNights,
  buildIcs,
  parseIcs,
  IcsParseError,
  NIGHT_START,
  NIGHT_END,
};
