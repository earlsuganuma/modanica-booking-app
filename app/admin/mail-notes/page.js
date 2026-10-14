"use client";

import { useEffect, useState } from "react";
import AdminNav from "../../../components/AdminNav";

// プランごとの確定メール追記文の編集画面。
export default function AdminMailNotesPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({}); // { [planId]: "saving" | "saved" | エラー文 }

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/mail-notes", { cache: "no-store" });
      const data = await res.json();
      setPlans(data.plans || []);
      setLoading(false);
    })();
  }, []);

  function setNote(id, value) {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, note: value } : p)));
    setStatus((prev) => ({ ...prev, [id]: undefined }));
  }

  async function save(plan) {
    setStatus((prev) => ({ ...prev, [plan.id]: "saving" }));
    const res = await fetch("/api/admin/mail-notes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, note: plan.note }),
    });
    const data = await res.json().catch(() => ({}));
    setStatus((prev) => ({ ...prev, [plan.id]: res.ok ? "saved" : data.message || "保存に失敗しました。" }));
  }

  return (
    <div className="space-y-6">
      <AdminNav />
      <div>
        <h1 className="text-xl font-bold">確定メール文面（プラン別）</h1>
        <p className="text-sm text-black/50 mt-1">
          予約を「確定」にしたときにお客様へ送るメールの、本文の最後（予約内容の下）に追記する文章を、プランごとに設定します。
          空欄のプランは追記しません。予約番号・日時・人数・金額・お支払いの案内は、自動で入ります。
        </p>
        <p className="text-xs text-black/40 mt-1">例：集合場所、駐車場のご案内、持ち物、当日のお支払い方法、キャンセル規定 など</p>
      </div>

      {loading ? (
        <p className="text-sm text-black/40">読み込み中…</p>
      ) : (
        <div className="space-y-4">
          {plans.map((p) => (
            <div key={p.id} className="rounded-2xl bg-white p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold text-sm">
                  <span className="font-mono text-xs text-black/40 mr-2">{p.id}</span>
                  {p.name}
                </h2>
                <div className="flex items-center gap-3">
                  {status[p.id] === "saved" && <span className="text-xs text-emerald-600">保存しました</span>}
                  {status[p.id] && status[p.id] !== "saved" && status[p.id] !== "saving" && (
                    <span className="text-xs text-red-600">{status[p.id]}</span>
                  )}
                  <button
                    onClick={() => save(p)}
                    disabled={status[p.id] === "saving"}
                    className="text-xs rounded-full bg-ink text-white px-4 py-1.5 hover:opacity-90 disabled:opacity-40"
                  >
                    {status[p.id] === "saving" ? "保存中…" : "保存"}
                  </button>
                </div>
              </div>
              <textarea
                value={p.note}
                onChange={(e) => setNote(p.id, e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder="（追記なし）"
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
