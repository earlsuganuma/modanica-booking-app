// 私用・予約不可の日時。予約とは別テーブル（private_blocks）で管理し、
// 登録した日時は全プランで予約できなくなる（lib/availability.js が参照）。
// 自前の予約カレンダーには表示するが、Googleカレンダーには反映しない。
const { query } = require("./db");

function toBlock(r) {
  return {
    id: r.id,
    title: r.title,
    note: r.note || "",
    startDatetime: r.start_datetime,
    endDatetime: r.end_datetime,
  };
}

// テーブル未作成などでエラーになっても、予約処理が止まらないよう空配列を返す。
async function listBlocks() {
  try {
    const res = await query("SELECT * FROM private_blocks ORDER BY start_datetime");
    return res.rows.map(toBlock);
  } catch (e) {
    console.error("listBlocks failed:", e.message);
    return [];
  }
}

async function createBlock({ title, note, startDatetime, endDatetime }) {
  const res = await query(
    "INSERT INTO private_blocks (title, note, start_datetime, end_datetime) VALUES ($1, $2, $3, $4) RETURNING *",
    [title, note || "", startDatetime, endDatetime]
  );
  return toBlock(res.rows[0]);
}

async function deleteBlock(id) {
  await query("DELETE FROM private_blocks WHERE id = $1", [id]);
}

module.exports = { listBlocks, createBlock, deleteBlock };
