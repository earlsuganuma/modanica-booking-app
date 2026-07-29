"use client";

import { useEffect, useState } from "react";
import AdminNav from "../../../components/AdminNav";

const TYPE_LABEL = {
  reservation_received: "予約受付（お客様宛）",
  reservation_confirmed: "予約確定（お客様宛）",
  reservation_cancelled: "予約キャンセル（お客様宛）",
  admin_notify: "新規予約通知（運営者宛）",
};

const STATUS_BADGE = {
  sent: { label: "送信済み", bg: "#d1fae5", color: "#065f46" },
  logged: { label: "未送信（記録のみ）", bg: "#e5e7eb", color: "#374151" },
  failed: { label: "送信失敗", bg: "#fee2e2", color: "#991b1b" },
};

export default function MailLogPage() {
  const [mailLog, setMailLog] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/mail-log", { cache: "no-store" });
    const data = await res.json();
    setMailLog(data.mailLog || []);
    setConfigured(!!data.configured);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <AdminNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">メール送信ログ</h1>
          <p className="text-sm text-black/50 mt-1">
            予約の受付・確定・キャンセル時に送信されるメールの記録です。
          </p>
        </div>
        <button onClick={load} className="text-xs underline text-black/40">再読み込み</button>
      </div>

      {!configured && (
        <div className="rounded-2xl bg-amber-50 text-amber-800 text-sm p-4">
          RESEND_API_KEY が未設定のため、メールは実際には送信されず、ここに内容だけ記録されています。
          実際に送信するには、プロジェクト直下に <code>.env.local</code> を作成し、Resendで取得したAPIキー等を
          設定してからサーバーを再起動してください（<code>.env.local.example</code> を参考にしてください）。
        </div>
      )}

      {loading ? (
        <p className="text-sm text-black/40">読み込み中…</p>
      ) : mailLog.length === 0 ? (
        <p className="text-sm text-black/40">まだメールの送信記録はありません。</p>
      ) : (
        <div className="space-y-3">
          {mailLog.map((m) => {
            const badge = STATUS_BADGE[m.status] || STATUS_BADGE.logged;
            return (
              <div key={m.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-sm">{TYPE_LABEL[m.type] || m.type}</span>{" "}
                    <span className="badge" style={{ background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="text-xs text-black/40">{new Date(m.createdAt).toLocaleString("ja-JP")}</div>
                </div>
                <div className="mt-2 text-sm text-black/60">宛先：{m.to || "（なし）"}</div>
                <div className="text-sm text-black/80">件名：{m.subject}</div>
                {m.error && <div className="mt-1 text-xs text-red-600">エラー：{m.error}</div>}
                <button
                  onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                  className="mt-2 text-xs text-black/40 underline"
                >
                  {expanded === m.id ? "本文を閉じる" : "本文を表示"}
                </button>
                {expanded === m.id && (
                  <pre className="mt-2 whitespace-pre-wrap text-xs bg-black/[0.03] rounded-lg p-3">{m.body}</pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
