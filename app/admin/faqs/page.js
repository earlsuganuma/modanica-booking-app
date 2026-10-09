"use client";

import { useEffect, useState } from "react";
import AdminNav from "../../../components/AdminNav";

const CATEGORIES = [
  { value: "facility", label: "施設利用プラン" },
  { value: "cafe", label: "カフェ系プラン" },
];

export default function AdminFaqsPage() {
  const [category, setCategory] = useState("facility");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  async function load(cat) {
    setLoading(true);
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/admin/faqs?category=${cat}`, { cache: "no-store" });
    const data = await res.json();
    setItems((data.faqs || []).map((f) => ({ question: f.question, answer: f.answer })));
    setLoading(false);
  }

  useEffect(() => {
    load(category);
  }, [category]);

  function update(index, field, value) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  }

  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  }

  function remove(index) {
    if (!window.confirm("このQ&Aを削除しますか？（「保存する」を押すまで確定しません）")) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);
    const res = await fetch("/api/admin/faqs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, items }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.message || "保存に失敗しました。");
      return;
    }
    setMessage(`保存しました（${data.count}件）`);
    await load(category);
    setMessage(`保存しました（${data.count}件）`);
  }

  return (
    <div className="space-y-6">
      <AdminNav />
      <div>
        <h1 className="text-xl font-bold">Q&A管理</h1>
        <p className="text-sm text-black/50 mt-1">
          プラン一覧・詳細ページの下部に表示される「よくあるご質問」を編集できます。カテゴリごとに管理します。
        </p>
      </div>

      <div className="flex gap-2 text-xs">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`rounded-full px-4 py-1.5 border ${
              category === c.value ? "bg-ink text-white border-ink" : "border-black/20 text-black/50"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-black/40">読み込み中…</p>
      ) : (
        <div className="space-y-3">
          {items.length === 0 && <p className="text-sm text-black/40">Q&Aはまだありません。</p>}
          {items.map((it, i) => (
            <div key={i} className="rounded-2xl bg-white p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-black/40">#{i + 1}</span>
                <span className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="text-black/40 hover:text-black disabled:opacity-20"
                    aria-label="上に移動"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === items.length - 1}
                    className="text-black/40 hover:text-black disabled:opacity-20"
                    aria-label="下に移動"
                  >
                    ▼
                  </button>
                  <button type="button" onClick={() => remove(i)} className="text-red-600 hover:underline">
                    削除
                  </button>
                </span>
              </div>
              <label className="block text-sm">
                <span className="text-black/50">質問</span>
                <input
                  value={it.question}
                  onChange={(e) => update(i, "question", e.target.value)}
                  maxLength={200}
                  className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-black/50">回答（改行は表示に反映されます）</span>
                <textarea
                  value={it.answer}
                  onChange={(e) => update(i, "answer", e.target.value)}
                  rows={3}
                  maxLength={2000}
                  className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
                />
              </label>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setItems([...items, { question: "", answer: "" }])}
            className="text-sm rounded-full border border-dashed border-black/30 px-4 py-2 hover:bg-black/5"
          >
            ＋ Q&Aを追加
          </button>

          {error && <div className="text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3">{error}</div>}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "保存中…" : "保存する"}
            </button>
            {message && <span className="text-xs text-emerald-700">{message}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
