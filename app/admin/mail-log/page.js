"use client";

import { useEffect, useMemo, useState } from "react";
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

const PAGE_SIZE = 30;

export default function MailLogPage() {
  const [mailLog, setMailLog] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);

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

  // 新しい順に並べ、種別・状態・キーワード（宛先／件名）で絞り込む。
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return [...mailLog]
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .filter((m) => (typeFilter === "all" ? true : m.type === typeFilter))
      .filter((m) => (statusFilter === "all" ? true : m.status === statusFilter))
      .filter((m) => !kw || `${m.to || ""} ${m.subject || ""}`.toLowerCase().includes(kw));
  }, [mailLog, typeFilter, statusFilter, keyword]);

  const shown = filtered.slice(0, limit);

  function fmt(iso) {
    const d = new Date(iso);
    const p2 = (n) => String(n).padStart(2, "0");
    return `${d.getMonth() + 1}/${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  }

  return (
    <div className="space-y-6">
      <AdminNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">メール送信ログ</h1>
          <p className="text-sm text-black/50 mt-1">
            予約の受付・確定・キャンセル時に送信されるメールの記録です（新しい順）。
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

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setLimit(PAGE_SIZE); }}
          className="rounded-full border border-black/15 px-3 py-1.5"
        >
          <option value="all">すべての種類</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setLimit(PAGE_SIZE); }}
          className="rounded-full border border-black/15 px-3 py-1.5"
        >
          <option value="all">すべての状態</option>
          <option value="sent">送信済み</option>
          <option value="failed">送信失敗</option>
          <option value="logged">未送信（記録のみ）</option>
        </select>
        <input
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setLimit(PAGE_SIZE); }}
          placeholder="宛先・件名で検索"
          className="rounded-full border border-black/15 px-4 py-1.5 w-56"
        />
        <span className="text-black/40">{filtered.length}件</span>
      </div>

      {loading ? (
        <p className="text-sm text-black/40">読み込み中…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-black/40">該当するメールの記録はありません。</p>
      ) : (
        <div className="rounded-2xl bg-white shadow-sm overflow-hidden divide-y divide-black/5">
          {shown.map((m) => {
            const badge = STATUS_BADGE[m.status] || STATUS_BADGE.logged;
            const open = expanded === m.id;
            return (
              <div key={m.id}>
                <button
                  onClick={() => setExpanded(open ? null : m.id)}
                  className="w-full text-left px-4 py-2.5 hover:bg-black/[0.03] flex flex-wrap items-center gap-x-3 gap-y-1"
                >
                  <span className="text-xs text-black/40 w-24 shrink-0">{fmt(m.createdAt)}</span>
                  <span className="badge shrink-0" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                  <span className="text-xs text-black/50 shrink-0">{TYPE_LABEL[m.type] || m.type}</span>
                  <span className="text-xs text-black/60 truncate max-w-[16rem]">{m.to || "（なし）"}</span>
                  <span className="text-sm text-black/80 truncate flex-1 min-w-[10rem]">{m.subject}</span>
                  <span className="text-xs text-black/30">{open ? "▲" : "▼"}</span>
                </button>
                {open && (
                  <div className="px-4 pb-4 space-y-2">
                    <div className="text-xs text-black/50">
                      {new Date(m.createdAt).toLocaleString("ja-JP")} ／ 宛先：{m.to || "（なし）"}
                    </div>
                    {m.error && <div className="text-xs text-red-600">エラー：{m.error}</div>}
                    <pre className="whitespace-pre-wrap text-xs bg-black/[0.03] rounded-lg p-3">{m.body}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > shown.length && (
        <div className="text-center">
          <button
            onClick={() => setLimit(limit + PAGE_SIZE)}
            className="text-xs rounded-full border border-black/20 px-5 py-2 hover:bg-black/5"
          >
            さらに{Math.min(PAGE_SIZE, filtered.length - shown.length)}件を表示（残り{filtered.length - shown.length}件）
          </button>
        </div>
      )}
    </div>
  );
}
