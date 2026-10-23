// 管理画面で変更できる設定（app_settings テーブル）。plans等の全件入れ替え方式の load()/save() とは独立。
const { query } = require("./db");

async function getSettings(prefix) {
  try {
    const res = await query("SELECT key, value FROM app_settings WHERE key LIKE $1", [`${prefix}%`]);
    return Object.fromEntries(res.rows.map((r) => [r.key, r.value]));
  } catch (e) {
    console.error("getSettings failed:", e.message);
    return {};
  }
}

async function setSetting(key, value) {
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, String(value)]
  );
}

module.exports = { getSettings, setSetting };
