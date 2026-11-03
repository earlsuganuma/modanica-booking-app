const { withTransaction } = require("./db");

// メール送信は Resend（https://resend.com）のREST APIを直接呼び出す形にしている
// （専用SDKは使わず fetch のみで完結させ、依存パッケージを増やさない）。
//
// 環境変数（.env.local に設定する）:
//   RESEND_API_KEY      Resendのシークレットキー（未設定の場合は実際には送信せず、ログにのみ記録する＝開発中の動作確認用）
//   MAIL_FROM           送信元アドレス（例: "MODANICA <booking@example.com>"）。Resend側でドメイン認証したアドレスを指定する
//   ADMIN_NOTIFY_EMAIL  新規予約が入ったときに運営者へ通知したいアドレス（任意。複数指定はカンマ区切り）
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const MAIL_FROM = process.env.MAIL_FROM || "MODANICA <onboarding@resend.dev>";
const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || "";

// 送信ログ（mail_log）への記録。mail_log に1行 INSERT し、古いものを300件まで間引くだけで、他のテーブルには触れない。
// （以前は store の load()/save() で全テーブルを読み直して書き戻しており、同時に入った予約や、
//   外部キーで連鎖する OTA 取り込みURL などを消してしまうことがあった）
async function appendLog(entry) {
  try {
    await withTransaction(async (client) => {
      const c = await client.query(
        `INSERT INTO counters (name, value) VALUES ('nextMailLogId', 2)
         ON CONFLICT (name) DO UPDATE SET value = counters.value + 1
         RETURNING value - 1 AS id`
      );
      const id = c.rows[0].id;
      await client.query(
        `INSERT INTO mail_log (id, type, "to", subject, body, status, error, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7, now())`,
        [id, entry.type ?? null, entry.to ?? "", entry.subject ?? null, entry.body ?? null, entry.status ?? null, entry.error ?? null]
      );
      // 直近300件だけ保持する
      await client.query(`DELETE FROM mail_log WHERE id NOT IN (SELECT id FROM mail_log ORDER BY id DESC LIMIT 300)`);
    });
  } catch (e) {
    // ログの記録に失敗しても、メール送信や予約処理は止めない
    console.error("mail log append failed:", e.message);
  }
}

/**
 * メールを送信する（RESEND_API_KEY未設定時は送信せずログにのみ記録する）。
 * @param {object} params
 * @param {string} params.type - 'reservation_received' | 'reservation_confirmed' | 'reservation_cancelled' | 'admin_notify' など、ログ・管理画面での分類用
 * @param {string} params.to - 宛先（カンマ区切りで複数可）
 * @param {string} params.subject
 * @param {string} params.text
 */
async function sendMail({ type, to, subject, text }) {
  if (!to) {
    await appendLog({ type, to: "", subject, body: text, status: "failed", error: "宛先メールアドレスがありません" });
    return { ok: false, mode: "skipped" };
  }

  if (!RESEND_API_KEY) {
    // APIキー未設定：実際には送らず、送信予定の内容だけログに残す（管理画面の「メール送信ログ」で確認できる）
    await appendLog({ type, to, subject, body: text, status: "logged" });
    return { ok: true, mode: "logged" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: to.split(",").map((s) => s.trim()).filter(Boolean),
        subject,
        text,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      await appendLog({ type, to, subject, body: text, status: "failed", error: `HTTP ${res.status}: ${errBody}` });
      return { ok: false, mode: "sent_error" };
    }

    await appendLog({ type, to, subject, body: text, status: "sent" });
    return { ok: true, mode: "sent" };
  } catch (e) {
    await appendLog({ type, to, subject, body: text, status: "failed", error: String(e && e.message ? e.message : e) });
    return { ok: false, mode: "exception" };
  }
}

module.exports = { sendMail, ADMIN_NOTIFY_EMAIL, isConfigured: () => !!RESEND_API_KEY };
