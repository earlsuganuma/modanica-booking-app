"use client";

import { useEffect, useState } from "react";
import AdminNav from "../../../components/AdminNav";

const TYPE_LABEL = { holiday: "祝日", season: "シーズン", custom: "個別設定" };

function EditableRow({ rule, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    label: rule.label,
    startDate: rule.startDate,
    endDate: rule.endDate,
    coefficient: String(rule.coefficient),
    type: rule.type,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/admin/price-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: form.label,
        startDate: form.startDate,
        endDate: form.endDate || form.startDate,
        coefficient: form.coefficient,
        type: form.type,
      }),
    });
    setSaving(false);
    setEditing(false);
    onSaved();
  }

  async function handleDelete() {
    await fetch(`/api/admin/price-rules/${rule.id}`, { method: "DELETE" });
    onDeleted();
  }

  if (!editing) {
    return (
      <tr className="border-t border-black/5">
        <td className="px-4 py-2">{rule.label}</td>
        <td className="px-4 py-2 text-black/60">
          {rule.startDate}{rule.endDate !== rule.startDate ? ` 〜 ${rule.endDate}` : ""}
        </td>
        <td className="px-4 py-2 text-black/60">{TYPE_LABEL[rule.type] || rule.type}</td>
        <td className="px-4 py-2 font-mono">×{rule.coefficient}</td>
        <td className="px-4 py-2 text-right whitespace-nowrap">
          <button onClick={() => setEditing(true)} className="text-xs text-ink hover:underline mr-3">
            編集
          </button>
          <button onClick={handleDelete} className="text-xs text-red-600 hover:underline">
            削除
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-black/5 bg-black/[0.02]">
      <td className="px-4 py-2">
        <input
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          className="w-full rounded border border-black/15 px-2 py-1 text-sm"
        />
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="rounded border border-black/15 px-2 py-1 text-sm"
          />
          <span className="text-black/30">〜</span>
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            className="rounded border border-black/15 px-2 py-1 text-sm"
          />
        </div>
      </td>
      <td className="px-4 py-2">
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="rounded border border-black/15 px-2 py-1 text-sm"
        >
          <option value="custom">個別設定</option>
          <option value="holiday">祝日</option>
          <option value="season">シーズン</option>
        </select>
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          step="0.1"
          min="0.1"
          value={form.coefficient}
          onChange={(e) => setForm({ ...form, coefficient: e.target.value })}
          className="w-20 rounded border border-black/15 px-2 py-1 text-sm"
        />
      </td>
      <td className="px-4 py-2 text-right whitespace-nowrap">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs text-emerald-700 hover:underline mr-3 disabled:opacity-40"
        >
          {saving ? "保存中…" : "保存"}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-black/40 hover:underline">
          取消
        </button>
      </td>
    </tr>
  );
}

export default function AdminCalendarPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ label: "", startDate: "", endDate: "", coefficient: "1.2", type: "custom" });
  const [error, setError] = useState(null);

  const nextYearCandidate = new Date().getFullYear() + 1;
  const [genYear, setGenYear] = useState(String(nextYearCandidate));
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/price-rules", { cache: "no-store" });
    const data = await res.json();
    setRules(data.priceRules || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError(null);
    if (!form.label || !form.startDate || !form.coefficient) {
      setError("名称・開始日・係数は必須です。");
      return;
    }
    const res = await fetch("/api/admin/price-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: form.label,
        startDate: form.startDate,
        endDate: form.endDate || form.startDate,
        coefficient: form.coefficient,
        type: form.type,
      }),
    });
    if (!res.ok) {
      setError("追加に失敗しました。");
      return;
    }
    setForm({ label: "", startDate: "", endDate: "", coefficient: "1.2", type: "custom" });
    load();
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenResult(null);
    const res = await fetch("/api/admin/price-rules/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: Number(genYear), includeSeasons: true, coefficient: 1.2 }),
    });
    const data = await res.json();
    setGenerating(false);
    if (res.ok) {
      setGenResult(
        `${genYear}年：祝日${data.createdHolidays}件・シーズン${data.createdSeasons}件を追加しました（既存分${data.skippedHolidays}件はスキップ）。`
      );
      load();
    } else {
      setGenResult("生成に失敗しました。");
    }
  }

  return (
    <div className="space-y-6">
      <AdminNav />
      <div>
        <h1 className="text-xl font-bold">料金カレンダー（祝日・シーズン設定）</h1>
        <p className="text-sm text-black/50 mt-1">
          指定した日付・期間に料金係数を設定できます。未設定の日は平日=1.0倍、週末=1.2倍が自動適用されます。
          複数のルールが重なる場合は、最も高い係数が採用されます。
        </p>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
        <h2 className="font-bold text-sm">翌年以降の祝日・シーズンを自動生成</h2>
        <p className="text-xs text-black/50">
          日本の祝日（ハッピーマンデー・振替休日・国民の休日を含む）と、GW・夏休み・年末年始のシーズン期間を計算して一括登録します。
          春分の日・秋分の日は国立天文台の確定発表前は推定値になるため、確定後は下の一覧から編集してください。
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={genYear}
            onChange={(e) => setGenYear(e.target.value)}
            className="w-28 rounded-lg border border-black/15 px-3 py-2 text-sm"
          />
          <span className="text-sm text-black/50">年分を生成</span>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-full bg-ink text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-40"
          >
            {generating ? "生成中…" : "生成する"}
          </button>
        </div>
        {genResult && <div className="text-sm text-emerald-700">{genResult}</div>}
      </div>

      <form onSubmit={handleAdd} className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
        <h2 className="font-bold text-sm">新規ルールを個別に追加</h2>
        <div className="grid sm:grid-cols-5 gap-3 text-sm">
          <label className="block sm:col-span-2">
            <span className="text-black/50">名称</span>
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="例：お盆ハイシーズン"
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-black/50">開始日</span>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-black/50">終了日（省略可）</span>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-black/50">係数</span>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={form.coefficient}
              onChange={(e) => setForm({ ...form, coefficient: e.target.value })}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-black/50">種別</span>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="mt-1 rounded-lg border border-black/15 px-3 py-2"
          >
            <option value="custom">個別設定</option>
            <option value="holiday">祝日</option>
            <option value="season">シーズン</option>
          </select>
        </label>
        {error && <div className="text-sm text-red-700">{error}</div>}
        <button className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:opacity-90">
          追加する
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-black/40">読み込み中…</p>
      ) : (
        <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-black/5 text-black/50">
              <tr>
                <th className="text-left px-4 py-2">名称</th>
                <th className="text-left px-4 py-2">期間</th>
                <th className="text-left px-4 py-2">種別</th>
                <th className="text-left px-4 py-2">係数</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <EditableRow key={r.id} rule={r} onSaved={load} onDeleted={load} />
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-black/40">
                    ルールがまだありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
