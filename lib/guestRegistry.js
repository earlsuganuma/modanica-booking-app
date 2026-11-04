// 宿泊者名簿フォーム（/checkin）の入力内容。OTA（Booking.com・Airbnb）のお客様は、名前・住所・性別などが
// OTAから取れないため、固定URLのフォームで入力してもらい、OTA予約（ota_blocks）に自動で紐づける。
//
// 紐づけのルール（lib/guestRegistry.js の pickBlock）：
//   1. 予約番号が入力されていて、OTA予約の予約番号と一致すれば、それ。
//   2. チェックイン日が同じOTA予約を探す。1件だけなら、それ。
//   3. 複数あるときは、まだ名簿が紐づいていないものを優先 → お名前の近いもの → 人数が同じもの、の順に絞る。
//   4. 1件に絞れなければ「紐づけ待ち」にして、管理画面で選ぶ。
// 紐づいたら、OTA予約の空欄（お客様名・人数・予約番号）だけを埋める。手入力した内容は上書きしない。
const { query } = require("./db");
const { listOtaBlocks } = require("./otaBlocks");
const { normalizeTel } = require("./repeater");
const { todayStr } = require("./dateUtil");
const { addDays } = require("./ical");

const LOOKBACK_DAYS = 30;

function toEntry(r) {
  return {
    id: r.id,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    checkIn: r.check_in,
    guestName: r.guest_name,
    address: r.address,
    tel: r.tel,
    email: r.email || "",
    guestMale: r.guest_male || 0,
    guestFemale: r.guest_female || 0,
    guestChildren: r.guest_children || 0,
    arrivalTime: r.arrival_time || "",
    nationality: r.nationality || "",
    passportNo: r.passport_no || "",
    bookingRef: r.booking_ref || "",
    note: r.note || "",
    otaBlockId: r.ota_block_id ?? null,
    linkStatus: r.link_status,
  };
}

function totalGuests(e) {
  return (e.guestMale || 0) + (e.guestFemale || 0) + (e.guestChildren || 0);
}

// ---------- お名前の近さ（ローマ字表記どうしの比較。語の順序や大文字小文字は問わない） ----------
function nameTokens(s) {
  return String(s || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[・,，.\-_]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}
function nameScore(a, b) {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return 0;
  if (ta.join("") === tb.join("")) return 1;
  const sb = new Set(tb);
  const common = ta.filter((t) => sb.has(t)).length;
  return common / Math.max(ta.length, tb.length);
}

// 入力内容に合うOTA予約を1件だけ返す。決められなければ null。
// blocks：OTA予約の一覧。linkedBlockIds：すでに名簿が紐づいているOTA予約のID（Set）。
function pickBlock(entry, blocks, linkedBlockIds = new Set()) {
  const ref = String(entry.bookingRef || "").trim();
  if (ref) {
    const byRef = blocks.filter((b) => b.bookingRef === ref);
    if (byRef.length === 1) return byRef[0];
  }
  let cands = blocks.filter(
    (b) => b.startDate === entry.checkIn && !(b.bookingRef && ref && b.bookingRef !== ref)
  );
  if (cands.length === 1) return cands[0];
  if (cands.length === 0) return null;

  const unlinked = cands.filter((b) => !linkedBlockIds.has(b.id));
  if (unlinked.length === 1) return unlinked[0];
  if (unlinked.length > 1) cands = unlinked;

  const scored = cands
    .map((b) => ({ b, s: b.guestName ? nameScore(entry.guestName, b.guestName) : 0 }))
    .filter((x) => x.s >= 0.5)
    .sort((x, y) => y.s - x.s);
  if (scored.length === 1 || (scored.length > 1 && scored[0].s > scored[1].s)) return scored[0].b;

  const total = totalGuests(entry);
  const sameCount = cands.filter((b) => b.guestCount != null && b.guestCount === total);
  if (sameCount.length === 1) return sameCount[0];
  return null;
}

async function linkedBlockIdSet(excludeEntryId = null) {
  const res = await query("SELECT ota_block_id FROM guest_registry WHERE ota_block_id IS NOT NULL AND id <> $1", [
    excludeEntryId || 0,
  ]);
  return new Set(res.rows.map((r) => r.ota_block_id));
}

// 名簿をOTA予約に紐づけ、OTA予約の空欄（お客様名・人数・予約番号）だけを埋める。
async function linkEntry(entryId, blockId) {
  const er = await query("SELECT * FROM guest_registry WHERE id = $1", [entryId]);
  if (!er.rows[0]) return null;
  const e = toEntry(er.rows[0]);
  const br = await query("SELECT * FROM ota_blocks WHERE id = $1", [blockId]);
  if (!br.rows[0]) return null;
  const b = br.rows[0];

  await query("UPDATE guest_registry SET ota_block_id = $2, link_status = 'linked' WHERE id = $1", [entryId, blockId]);

  const sets = [];
  const vals = [blockId];
  const add = (col, v) => {
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  };
  if (!b.guest_name && e.guestName) add("guest_name", e.guestName.slice(0, 100));
  if (b.guest_count == null && totalGuests(e) > 0) add("guest_count", totalGuests(e));
  if (!b.booking_ref && e.bookingRef) add("booking_ref", e.bookingRef);
  if (sets.length) await query(`UPDATE ota_blocks SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`, vals);
  return { entry: e, blockId };
}

async function unlinkEntry(entryId) {
  await query("UPDATE guest_registry SET ota_block_id = NULL, link_status = 'pending' WHERE id = $1", [entryId]);
}

async function deleteEntry(entryId) {
  await query("DELETE FROM guest_registry WHERE id = $1", [entryId]);
}

// 紐づけを試みる。紐づけできたら { linked:true, blockId }。
async function tryLink(entryRow) {
  const e = toEntry(entryRow);
  const blocks = await listOtaBlocks({ fromDate: addDays(todayStr(), -LOOKBACK_DAYS) });
  const linked = await linkedBlockIdSet(e.id);
  const block = pickBlock(e, blocks, linked);
  if (!block) return { linked: false };
  await linkEntry(e.id, block.id);
  return { linked: true, blockId: block.id };
}

// 入力内容を保存し、OTA予約への紐づけを試みる。
async function createEntry(input) {
  const res = await query(
    `INSERT INTO guest_registry
       (check_in, guest_name, address, tel, email, guest_male, guest_female, guest_children,
        arrival_time, nationality, passport_no, booking_ref, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [
      input.checkIn,
      input.guestName,
      input.address,
      input.tel,
      input.email || "",
      input.guestMale,
      input.guestFemale,
      input.guestChildren,
      input.arrivalTime || "",
      input.nationality || "",
      input.passportNo || "",
      input.bookingRef || "",
      input.note || "",
    ]
  );
  const row = res.rows[0];
  let result = { linked: false };
  try {
    result = await tryLink(row);
  } catch (e) {
    console.error("guestRegistry: tryLink failed:", e.message); // 紐づけに失敗しても、入力内容は保存済み（紐づけ待ちになる）
  }
  return { id: row.id, ...result };
}

// 紐づけ待ちの名簿を、もう一度紐づけてみる（OTAの予約が後から届いた場合に備えて、cronから呼ぶ）。
async function relinkPending() {
  let rows;
  try {
    const res = await query(
      "SELECT * FROM guest_registry WHERE link_status = 'pending' AND check_in >= $1 ORDER BY id",
      [addDays(todayStr(), -LOOKBACK_DAYS)]
    );
    rows = res.rows;
  } catch (e) {
    if (e && e.code !== "42P01") console.error("guestRegistry: relinkPending failed:", e.message);
    return { linked: 0 };
  }
  let linked = 0;
  for (const row of rows) {
    try {
      const r = await tryLink(row);
      if (r.linked) linked++;
    } catch (e) {
      console.error("guestRegistry: relink failed:", e.message);
    }
  }
  return { linked };
}

async function listPending() {
  try {
    const res = await query("SELECT * FROM guest_registry WHERE link_status = 'pending' ORDER BY created_at DESC");
    return res.rows.map(toEntry);
  } catch (e) {
    if (e && e.code !== "42P01") console.error("guestRegistry: listPending failed:", e.message);
    return [];
  }
}

// OTA予約ごとの名簿（blockId → 名簿の配列）
async function entriesByBlock(blockIds) {
  const map = new Map();
  if (!blockIds || !blockIds.length) return map;
  try {
    const res = await query("SELECT * FROM guest_registry WHERE ota_block_id = ANY($1) ORDER BY created_at", [blockIds]);
    for (const r of res.rows) {
      const e = toEntry(r);
      if (!map.has(e.otaBlockId)) map.set(e.otaBlockId, []);
      map.get(e.otaBlockId).push(e);
    }
  } catch (e) {
    if (e && e.code !== "42P01") console.error("guestRegistry: entriesByBlock failed:", e.message);
  }
  return map;
}

// リピーター判定用：名簿の電話番号とチェックイン日の一覧
async function allTelsAndDates() {
  try {
    const res = await query("SELECT tel, check_in FROM guest_registry");
    return res.rows.map((r) => ({ tel: r.tel, checkIn: r.check_in }));
  } catch (e) {
    return [];
  }
}

// 宿泊者名簿CSV用：OTAのお客様の名簿。紐づいたOTA予約が消えている（OTA側でキャンセル）ものは除く。
// 紐づけ待ちのものは、チェックイン日だけで出す。
async function listForCsv() {
  try {
    const res = await query(
      `SELECT g.*, b.start_date AS b_start, b.end_date AS b_end, b.channel AS b_channel
         FROM guest_registry g LEFT JOIN ota_blocks b ON b.id = g.ota_block_id
        WHERE g.ota_block_id IS NULL OR b.id IS NOT NULL
        ORDER BY g.check_in, g.id`
    );
    return res.rows.map((r) => ({
      ...toEntry(r),
      blockStart: r.b_start || "",
      blockEnd: r.b_end || "",
      channel: r.b_channel || "",
    }));
  } catch (e) {
    if (e && e.code !== "42P01") console.error("guestRegistry: listForCsv failed:", e.message);
    return [];
  }
}

/**
 * 同じ電話番号の、より前の宿泊の回数（自社の予約 ＋ OTAの名簿）。電話番号が使えないときは 0。
 * ownReservations：data.reservations（キャンセル済みは数えない）。registryRows：allTelsAndDates() の結果。
 */
function countPriorStays({ tel, checkIn, ownReservations, registryRows }) {
  const key = normalizeTel(tel);
  if (!key) return 0;
  const own = (ownReservations || []).filter(
    (r) => r.status !== "cancelled" && normalizeTel(r.customerTel) === key && String(r.startDatetime).slice(0, 10) < checkIn
  ).length;
  const dates = new Set(
    (registryRows || []).filter((x) => normalizeTel(x.tel) === key && x.checkIn < checkIn).map((x) => x.checkIn)
  );
  return own + dates.size;
}

// ---------- 公開フォーム用の簡易レート制限（IPごとに10分で10件まで） ----------
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (list.length >= 10) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  return false;
}

module.exports = {
  createEntry,
  linkEntry,
  unlinkEntry,
  deleteEntry,
  relinkPending,
  listPending,
  entriesByBlock,
  allTelsAndDates,
  listForCsv,
  countPriorStays,
  pickBlock,
  nameScore,
  toEntry,
  totalGuests,
  rateLimited,
};
