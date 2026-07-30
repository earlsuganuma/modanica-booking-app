"use client";

import { useEffect, useState } from "react";
import AdminNav from "../../../components/AdminNav";

const UNIT_LABEL_PRESETS = ["個", "人", "枚", "セット", "束", "回"];

function UnitLabelField({ value, onChange }) {
  const isPreset = UNIT_LABEL_PRESETS.includes(value);
  const [customMode, setCustomMode] = useState(!isPreset && !!value);

  return (
    <div>
      <select
        value={customMode ? "custom" : value || "個"}
        onChange={(e) => {
          if (e.target.value === "custom") {
            setCustomMode(true);
            onChange("");
          } else {
            setCustomMode(false);
            onChange(e.target.value);
          }
        }}
        className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
      >
        {UNIT_LABEL_PRESETS.map((u) => (
          <option key={u} value={u}>{u}</option>
        ))}
        <option value="custom">その他（自由入力）</option>
      </select>
      {customMode && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="例：台、本"
          className="mt-2 w-full rounded-lg border border-black/15 px-3 py-2"
        />
      )}
    </div>
  );
}

function OptionThumbnailManager({ option, onSaved }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpload(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", "options");
      formData.append("id", option.id);
      const uploadRes = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        setError(uploadData.message || "アップロードに失敗しました。");
        setUploading(false);
        return;
      }
      const previousUrl = option.imageUrl;
      await fetch(`/api/admin/options/${option.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: uploadData.url }),
      });
      if (previousUrl) {
        await fetch("/api/admin/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: previousUrl }),
        });
      }
      await onSaved();
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    const url = option.imageUrl;
    await fetch(`/api/admin/options/${option.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: null }),
    });
    if (url) {
      await fetch("/api/admin/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
    }
    await onSaved();
  }

  return (
    <div>
      <span className="text-sm text-black/50">サムネイル画像</span>
      <div className="mt-2 flex items-center gap-3">
        {option.imageUrl ? (
          <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-black/10">
            <img src={option.imageUrl} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-0.5 right-0.5 bg-black/60 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
              aria-label="削除"
            >
              ×
            </button>
          </div>
        ) : (
          <label className="w-16 h-16 rounded-lg border border-dashed border-black/20 flex items-center justify-center text-[10px] text-black/40 cursor-pointer hover:bg-black/5 text-center px-1">
            {uploading ? "アップロード中…" : "＋ 画像追加"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        )}
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function OptionEditor({ option, plans, onSaved, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({
    name: option.name,
    price: String(option.price ?? 0),
    description: option.description || "",
    unit: option.unit === "quantity" ? "quantity" : "flag",
    maxQuantity: option.maxQuantity === null || option.maxQuantity === undefined ? "" : String(option.maxQuantity),
    unitLabel: option.unitLabel || "個",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch(`/api/admin/options/${option.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
    onSaved();
  }

  async function handleDelete() {
    await fetch(`/api/admin/options/${option.id}`, { method: "DELETE" });
    onSaved();
  }

  async function togglePlan(planId, currentlyAttached, isDefault) {
    await fetch(`/api/admin/options/${option.id}/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, attach: !currentlyAttached, isDefault: !!isDefault }),
    });
    onSaved();
  }

  async function toggleDefault(planId, isDefault) {
    await fetch(`/api/admin/options/${option.id}/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, attach: true, isDefault: !isDefault }),
    });
    onSaved();
  }

  return (
    <div className="rounded-2xl bg-white shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          {option.imageUrl && (
            <img src={option.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
          )}
          <div>
            <span className="font-bold">{option.name}</span>{" "}
            <span className="text-black/50 text-sm">
              {option.price ? `+¥${option.price.toLocaleString()}` : "無料"}
              {option.unit === "quantity" ? `／${option.unitLabel || "個"}` : ""}
            </span>
            {option.unit === "quantity" && (
              <span className="ml-2 badge" style={{ background: "#e0e7ff", color: "#3730a3" }}>
                数量指定
                {option.maxQuantity != null ? `（最大${option.maxQuantity}${option.unitLabel || "個"}）` : ""}
              </span>
            )}
            {option.description && <div className="text-xs text-black/40">{option.description}</div>}
          </div>
        </div>
        <span className="flex items-center gap-2">
          <span className="flex flex-col">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
              disabled={isFirst}
              className="text-black/40 hover:text-black disabled:opacity-20 leading-none text-xs"
              aria-label="上に移動"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
              disabled={isLast}
              className="text-black/40 hover:text-black disabled:opacity-20 leading-none text-xs"
              aria-label="下に移動"
            >
              ▼
            </button>
          </span>
          <span className="text-xs text-black/40">{expanded ? "閉じる" : "編集する"}</span>
        </span>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-black/10 pt-4 space-y-4">
          <OptionThumbnailManager option={option} onSaved={onSaved} />

          <div className="grid sm:grid-cols-4 gap-3 text-sm">
            <label className="block sm:col-span-2">
              <span className="text-black/50">オプション名</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-black/50">価格（円）</span>
              <input
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-black/50">説明</span>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
              />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <label className="block">
              <span className="text-black/50">選択方式</span>
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
              >
                <option value="flag">チェックのみ（選択する／しない）</option>
                <option value="quantity">数量指定（個数を入力）</option>
              </select>
            </label>
            {form.unit === "quantity" && (
              <label className="block">
                <span className="text-black/50">最大数量（空欄＝上限なし）</span>
                <input
                  type="number"
                  min="1"
                  value={form.maxQuantity}
                  onChange={(e) => setForm({ ...form, maxQuantity: e.target.value })}
                  placeholder="例：10"
                  className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
                />
              </label>
            )}
            {form.unit === "quantity" && (
              <label className="block">
                <span className="text-black/50">単位</span>
                <UnitLabelField value={form.unitLabel} onChange={(v) => setForm({ ...form, unitLabel: v })} />
              </label>
            )}
          </div>
          {form.unit === "quantity" && (
            <p className="text-xs text-black/40">
              数量指定オプションの価格は「1{form.unitLabel || "個"}あたりの価格」として扱われ、予約フォームでお客様が入力した数量分の
              金額が加算されます（人数に連動した課金はされません）。
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "保存中…" : "保存する"}
            </button>
            {saved && <span className="text-xs text-emerald-700">保存しました</span>}
            <button onClick={handleDelete} className="text-xs text-red-600 hover:underline ml-auto">
              このオプションを削除
            </button>
          </div>

          <div className="border-t border-black/10 pt-3">
            <span className="text-sm text-black/50">対象プラン</span>
            <div className="mt-2 grid sm:grid-cols-2 gap-2">
              {plans.map((p) => {
                const attachment = option.plans.find((x) => x.planId === p.id);
                const attached = !!attachment;
                return (
                  <div key={p.id} className="flex items-center justify-between text-sm bg-black/[0.02] rounded-lg px-3 py-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={attached}
                        onChange={() => togglePlan(p.id, attached, attachment?.isDefault)}
                      />
                      <span>#{p.code} {p.name}</span>
                    </label>
                    {attached && (
                      <label className="flex items-center gap-1 text-xs text-black/50">
                        <input
                          type="checkbox"
                          checked={!!attachment.isDefault}
                          onChange={() => toggleDefault(p.id, attachment.isDefault)}
                        />
                        デフォルト
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminOptionsPage() {
  const [options, setOptions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", price: "0", description: "", unit: "flag", maxQuantity: "", unitLabel: "個" });
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/options", { cache: "no-store" });
    const data = await res.json();
    setOptions(data.options || []);
    setPlans(data.plans || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError(null);
    if (!form.name) {
      setError("オプション名は必須です。");
      return;
    }
    const res = await fetch("/api/admin/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setError("追加に失敗しました。");
      return;
    }
    setForm({ name: "", price: "0", description: "", unit: "flag", maxQuantity: "", unitLabel: "個" });
    load();
  }

  async function handleMove(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= options.length) return;
    const reordered = [...options];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setOptions(reordered);
    await fetch("/api/admin/options/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((o) => o.id) }),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <AdminNav />
      <div>
        <h1 className="text-xl font-bold">プランオプション管理</h1>
        <p className="text-sm text-black/50 mt-1">
          オプション（例：食材セット手配）を登録し、どのプランで選択できるかを設定します。
          「数量指定」にすると、お客様が個数を入力できるオプションになります（例：追加テーブル、レンタル用品など）。
        </p>
      </div>

      <form onSubmit={handleAdd} className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
        <h2 className="font-bold text-sm">新規オプションを追加</h2>
        <div className="grid sm:grid-cols-4 gap-3 text-sm">
          <label className="block sm:col-span-2">
            <span className="text-black/50">オプション名</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例：飲み放題"
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-black/50">価格（円）</span>
            <input
              type="number"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-black/50">説明</span>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </label>
        </div>
        <div className="grid sm:grid-cols-4 gap-3 text-sm">
          <label className="block sm:col-span-2">
            <span className="text-black/50">選択方式</span>
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            >
              <option value="flag">チェックのみ（選択する／しない）</option>
              <option value="quantity">数量指定（個数を入力）</option>
            </select>
          </label>
          {form.unit === "quantity" && (
            <label className="block">
              <span className="text-black/50">最大数量（空欄＝上限なし）</span>
              <input
                type="number"
                min="1"
                value={form.maxQuantity}
                onChange={(e) => setForm({ ...form, maxQuantity: e.target.value })}
                placeholder="例：10"
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
              />
            </label>
          )}
          {form.unit === "quantity" && (
            <label className="block">
              <span className="text-black/50">単位</span>
              <UnitLabelField value={form.unitLabel} onChange={(v) => setForm({ ...form, unitLabel: v })} />
            </label>
          )}
        </div>
        {error && <div className="text-sm text-red-700">{error}</div>}
        <button className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:opacity-90">
          追加する
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-black/40">読み込み中…</p>
      ) : (
        <div className="space-y-3">
          {options.map((o, i) => (
            <OptionEditor
              key={o.id}
              option={o}
              plans={plans}
              onSaved={load}
              onMoveUp={() => handleMove(i, -1)}
              onMoveDown={() => handleMove(i, 1)}
              isFirst={i === 0}
              isLast={i === options.length - 1}
            />
          ))}
          {options.length === 0 && <p className="text-sm text-black/40">オプションはまだありません。</p>}
        </div>
      )}
    </div>
  );
}
