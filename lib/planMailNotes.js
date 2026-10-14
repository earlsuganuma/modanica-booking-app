// プランごとの確定メール追記文。plans等の全件入れ替え方式の load()/save()（lib/store.js）とは独立して、
// plan_mail_notes テーブルだけを単独で読み書きする（faqs と同じ方針）。
const { query } = require("./db");

// テーブル未作成などでエラーになっても、メール送信が止まらないよう空文字を返す。
async function getConfirmedNote(planId) {
  try {
    const res = await query("SELECT confirmed_note FROM plan_mail_notes WHERE plan_id = $1", [planId]);
    return res.rows.length ? res.rows[0].confirmed_note || "" : "";
  } catch (e) {
    console.error("getConfirmedNote failed:", e.message);
    return "";
  }
}

// { planId: note, ... }
async function listConfirmedNotes() {
  try {
    const res = await query("SELECT plan_id, confirmed_note FROM plan_mail_notes");
    return Object.fromEntries(res.rows.map((r) => [r.plan_id, r.confirmed_note || ""]));
  } catch (e) {
    console.error("listConfirmedNotes failed:", e.message);
    return {};
  }
}

async function saveConfirmedNote(planId, note) {
  await query(
    `INSERT INTO plan_mail_notes (plan_id, confirmed_note, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (plan_id) DO UPDATE SET confirmed_note = EXCLUDED.confirmed_note, updated_at = now()`,
    [planId, note]
  );
}

module.exports = { getConfirmedNote, listConfirmedNotes, saveConfirmedNote };
