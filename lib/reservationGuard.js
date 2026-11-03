// 予約の「空き判定 → 保存」を、同時に操作されても二重にならないように行う共通処理。
// 新規予約（お客様・管理画面）と、キャンセル済み予約を有効なステータスへ戻す処理から呼ぶ。
//
// 判定は lib/availability.js の hasConflict（既存の空室判定）をそのまま使う：
//   - 同じ部屋・同じ日時の有効な予約（キャンセル以外。貸切プランは全室を持つので全室と重なる）
//   - 私用・予約不可ブロック
//   - OTA（Booking.com・Airbnb）から取り込んだブロック（ota_blocks）
// これをトランザクションの中で、書き込み用の advisory lock を取ってから行い、同じトランザクションで保存する。
// ロックはコミット（またはロールバック）で自動的に外れる。
const { getPool } = require("./db");
const { hasConflict } = require("./availability");
const { roomByResource, channelLabel } = require("./otaBlocks");

const WRITE_LOCK_KEY = 73_510_422; // OTA 同期のロック（73_510_421）とは別
const LOCK_TIMEOUT = "15s";

async function withReservationWriteLock(fn) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`);
    await client.query("SELECT pg_advisory_xact_lock($1)", [WRITE_LOCK_KEY]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

function fmtDt(dt) {
  // "2026-11-14T20:00" → "2026-11-14 20:00"
  return String(dt || "").replace("T", " ");
}

function fmtRange(start, end) {
  if (start.slice(0, 10) === end.slice(0, 10)) return `${fmtDt(start)}〜${end.slice(11, 16)}`;
  return `${fmtDt(start)}〜${fmtDt(end)}`;
}

/**
 * 重なっている相手を、管理画面向けの日本語の行にする。
 * @param {object[]} conflicts hasConflict の conflicts
 * @param {{ plans: object[], resources: object[] }} data
 */
function describeConflicts(conflicts, data) {
  const resName = (id) => {
    const r = (data.resources || []).find((x) => x.id === id);
    return r ? r.name : id;
  };
  return conflicts.map(({ reservation: c }) => {
    if (c.otaBlock) {
      const room = roomByResource(c.resourceId);
      return `${channelLabel(c.channel)} の予約（OTAブロック）：${room ? room.label : resName(c.resourceId)} ${c.startDate} IN〜${c.endDate} OUT`;
    }
    if (c.privateBlock) {
      return `私用・予約不可「${c.title || ""}」：${fmtRange(c.startDatetime, c.endDatetime)}`;
    }
    const plan = (data.plans || []).find((p) => p.id === c.planId);
    const rooms = (c.resourceIds || []).map(resName).join("・");
    return `予約番号 ${c.id}（${plan ? plan.name : c.planId}）：${fmtRange(c.startDatetime, c.endDatetime)}／${rooms}`;
  });
}

/**
 * 空き判定（トランザクションの中で呼ぶ）。
 * @returns {{ conflict: boolean, adjustable: boolean, lines: string[] }}
 */
async function checkReservationConflict(client, { resourceIds, startDatetime, endDatetime, exclusivity, planId, excludeReservationId }, data) {
  const res = await hasConflict({
    resourceIds,
    startDatetime,
    endDatetime,
    exclusivity,
    planId,
    excludeReservationId: excludeReservationId != null ? Number(excludeReservationId) : undefined,
    client,
  });
  if (!res.conflict) return { conflict: false, adjustable: false, lines: [] };
  // 相手の予約オブジェクト（氏名・連絡先を含む）は返さず、整形済みの行だけを返す
  return { conflict: true, adjustable: !!res.adjustable, lines: data ? describeConflicts(res.conflicts, data) : [] };
}

/**
 * ロックを取り、空き判定に通ったときだけ write(client) を同じトランザクションで実行する。
 * @param {object} p
 * @param {object} p.check   hasConflict に渡す条件（resourceIds, startDatetime, endDatetime, exclusivity, planId, excludeReservationId）
 * @param {object} p.data    メッセージ用（plans・resources を含む load() の結果）
 * @param {(client, ctx) => Promise<any>} p.write  保存処理。ctx.nextReservationId はロック後に DB から読んだ最新の採番値
 * @param {(client) => Promise<object|null>} [p.precheck]  ロック後の最初に呼ぶ。値を返したら保存せずに { ok: true, reused } を返す
 * @returns {{ ok: true, value } | { ok: true, reused } | { ok: false, conflict }}
 */
async function commitWithConflictCheck({ check, data, write, precheck }) {
  return withReservationWriteLock(async (client) => {
    // 二重送信など：同じ決済の予約がすでに保存されていれば、それを返す（判定・保存はしない）
    if (precheck) {
      const existing = await precheck(client);
      if (existing) return { ok: true, reused: existing };
    }
    const conflict = await checkReservationConflict(client, check, data);
    if (conflict.conflict) return { ok: false, conflict };
    // 予約番号は、ロックを取った後の最新値で振る（同時に作られても番号がぶつからない）
    const c = await client.query(
      "SELECT GREATEST((SELECT value FROM counters WHERE name = 'nextReservationId'), (SELECT COALESCE(MAX(id), 0) + 1 FROM reservations)) AS next"
    );
    const value = await write(client, { nextReservationId: Number(c.rows[0].next) || 1 });
    return { ok: true, value };
  });
}

function adminConflictMessage(lines, lead = "この日程は次の予約・ブロックと重なっているため、保存できません。") {
  return [lead, ...lines.map((l) => `・${l}`)].join("\n");
}

module.exports = {
  withReservationWriteLock,
  checkReservationConflict,
  commitWithConflictCheck,
  describeConflicts,
  adminConflictMessage,
  WRITE_LOCK_KEY,
};
