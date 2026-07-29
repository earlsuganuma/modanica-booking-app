const { load, save } = require("./store");

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

async function appendLog(entry) {
  const data = await load();
  const id = data.nextMailLogId || 1;
  data.mailLog.unshift({ id, createdAt: new Date().toISOString(), ...entry });
  // ログが際限なく増えないよう、直近300件だけ保持する
  data.mailLog = data.mailLog.slice(0, 300);
  data.nextMailLogId = id + 1;
  await save(data);
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
