"use client";

import { useEffect, useState } from "react";
import AdminNav from "../../../components/AdminNav";

const CONFIRMATION_OPTIONS = [
  { value: "manual", label: "要確認（仮予約→運営者が確定）" },
  { value: "auto", label: "自動確定" },
  { value: "inquiry_only", label: "要問い合わせ（オンライン予約不可）" },
];

const SLOT_LABELS = [
  { key: "slot_am", label: "1部（11:00〜16:00）" },
  { key: "slot_pm", label: "2部（17:00〜22:00）" },
  { key: "slot_full", label: "1日（11:00〜22:00）" },
];

function resolveConfirmation(plan, dayType) {
  const rules = plan.confirmationRules || [];
  const specific = rules.find((r) => r.day_type === dayType);
  if (specific) return specific.confirmation_type;
  const all = rules.find((r) => r.day_type === "all");
  if (all) return all.confirmation_type;
  return "manual";
}

function PlanImageManager({ plan, onSaved }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const images = plan.images || [];

  async function handleUpload(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (images.length >= 3) {
      setError("画像は最大3枚までです。");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", "plans");
      formData.append("id", plan.id);
      const uploadRes = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        setError(uploadData.message || "アップロードに失敗しました。");
        setUploading(false);
        return;
      }
      const nextImages = [...images, uploadData.url];
      await fetch(`/api/admin/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: nextImages }),
      });
      await onSaved();
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(url) {
    const nextImages = images.filter((u) => u !== url);
    await fetch(`/api/admin/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: nextImages }),
    });
    await fetch("/api/admin/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    await onSaved();
  }

  return (
    <div>
      <span className="text-sm text-black/50">プラン詳細ページの画像（最大3枚、フェード切替で表示）</span>
      <div className="mt-2 flex flex-wrap gap-3">
        {images.map((url) => (
          <div key={url} className="relative w-24 h-24 rounded-lg overflow-hidden border border-black/10">
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => handleRemove(url)}
              className="absolute top-1 right-1 bg-black/60 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
              aria-label="削除"
            >
              ×
            </button>
          </div>
        ))}
        {images.length < 3 && (
          <label className="w-24 h-24 rounded-lg border border-dashed border-black/20 flex items-center justify-center text-xs text-black/40 cursor-pointer hover:bg-black/5">
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

function PlanEditor({ plan, onSaved, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({
    name: plan.name,
    description: plan.description || "",
    basePrice: String(plan.base_price),
    minGuests: String(plan.min_guests),
    maxGuests: String(plan.max_guests),
    bookingOpenDaysBefore: plan.booking_open_days_before === null ? "" : String(plan.booking_open_days_before),
    finalBookingDeadlineDaysBefore:
      plan.final_booking_deadline_days_before === null || plan.final_booking_deadline_days_before === undefined
        ? ""
        : String(plan.final_booking_deadline_days_before),
    slotPriceAm: String((plan.slot_prices && plan.slot_prices.slot_am) ?? plan.base_price),
    slotPricePm: String((plan.slot_prices && plan.slot_prices.slot_pm) ?? plan.base_price),
    slotPriceFull: String((plan.slot_prices && plan.slot_prices.slot_full) ?? plan.base_price),
    weekday: resolveConfirmation(plan, "weekday"),
    weekendHoliday: resolveConfirmation(plan, "weekend_holiday"),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch(`/api/admin/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        basePrice: form.basePrice,
        minGuests: form.minGuests,
        maxGuests: form.maxGuests,
        bookingOpenDaysBefore: form.bookingOpenDaysBefore,
        finalBookingDeadlineDaysBefore: form.finalBookingDeadlineDaysBefore,
        confirmation: { weekday: form.weekday, weekend_holiday: form.weekendHoliday },
        ...(plan.time_type === "slot3"
          ? {
              slotPrices: {
                slot_am: form.slotPriceAm,
                slot_pm: form.slotPricePm,
                slot_full: form.slotPriceFull,
              },
            }
          : {}),
      }),
    });
    setSaving(false);
    setSaved(true);
    onSaved();
  }

  return (
    <div className="rounded-2xl bg-white shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <span className="text-xs text-black/40 mr-2">#{plan.code}</span>
          <span className="font-bold">{plan.name}</span>
          <span className="ml-2 text-xs text-black/40">
            {plan.category === "facility" ? "施設利用" : "カフェ"} ／ ¥{plan.base_price.toLocaleString()}〜
          </span>
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
          <div className="text-xs text-black/40">
            対象リソース：{plan.resources.map((r) => r.name).join(" / ")}　／
            排他性：{plan.exclusivity}　／　時間帯タイプ：{plan.time_type}（構造変更は本画面では未対応）
          </div>

          <PlanImageManager plan={plan} onSaved={onSaved} />

          <label className="block text-sm">
            <span className="text-black/50">プラン名</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="text-black/50">説明文</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </label>

          <div className="grid sm:grid-cols-3 gap-3">
            <label className="block text-sm">
              <span className="text-black/50">基本料金（円）</span>
              <input
                type="number"
                min="0"
                value={form.basePrice}
                onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-black/50">最少人数</span>
              <input
                type="number"
                min="1"
                value={form.minGuests}
                onChange={(e) => setForm({ ...form, minGuests: e.target.value })}
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-black/50">最大人数</span>
              <input
                type="number"
                min="1"
                value={form.maxGuests}
                onChange={(e) => setForm({ ...form, maxGuests: e.target.value })}
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
              />
            </label>
          </div>

          {plan.time_type === "slot3" && (
            <div>
              <span className="text-sm text-black/50">枠ごとの料金（円）</span>
              <div className="mt-1 grid sm:grid-cols-3 gap-3">
                <label className="block text-sm">
                  <span className="text-black/40 text-xs">{SLOT_LABELS[0].label}</span>
                  <input
                    type="number"
                    min="0"
                    value={form.slotPriceAm}
                    onChange={(e) => setForm({ ...form, slotPriceAm: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-black/40 text-xs">{SLOT_LABELS[1].label}</span>
                  <input
                    type="number"
                    min="0"
                    value={form.slotPricePm}
                    onChange={(e) => setForm({ ...form, slotPricePm: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-black/40 text-xs">{SLOT_LABELS[2].label}</span>
                  <input
                    type="number"
                    min="0"
                    value={form.slotPriceFull}
                    onChange={(e) => setForm({ ...form, slotPriceFull: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
                  />
                </label>
              </div>
              <p className="text-xs text-black/40 mt-1">
                予約時に選択した枠に応じて、こちらの料金（曜日・祝日・シーズン係数を掛けた金額）が適用されます。
                上の「基本料金」欄はプラン一覧・詳細ページの「〜円から」の目安表示にのみ使われます。
              </p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-black/50">受付開始（何日前から予約を受け付けるか。空欄＝随時受付）</span>
              <input
                type="number"
                min="0"
                value={form.bookingOpenDaysBefore}
                onChange={(e) => setForm({ ...form, bookingOpenDaysBefore: e.target.value })}
                placeholder="例：30（空欄で随時）"
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-black/50">最終受付期限（利用日の何日前までオンライン予約を受け付けるか。空欄＝当日まで受付）</span>
              <input
                type="number"
                min="0"
                value={form.finalBookingDeadlineDaysBefore}
                onChange={(e) => setForm({ ...form, finalBookingDeadlineDaysBefore: e.target.value })}
                placeholder="例：3（空欄で当日まで）"
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
              />
            </label>
          </div>
          <p className="text-xs text-black/40">
            最終受付期限は、宿泊・施設貸切プランの「もうこの日程には入らない」タイミングの目安にもなります。
            カフェ・部分利用プランの予約は、競合しうる優先プランの最終受付期限を過ぎるまで、
            管理画面上で「仮予約」として表示されます。
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-black/50">平日の確定方式</span>
              <select
                value={form.weekday}
                onChange={(e) => setForm({ ...form, weekday: e.target.value })}
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
              >
                {CONFIRMATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-black/50">週末・祝日の確定方式</span>
              <select
                value={form.weekendHoliday}
                onChange={(e) => setForm({ ...form, weekendHoliday: e.target.value })}
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
              >
                {CONFIRMATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-black/40">
            「要問い合わせ」に設定した曜日は、オンラインでの空き状況確認・予約送信の両方がブロックされ、
            お電話・メールでのお問い合わせ案内が表示されます。
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-ink text-white px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "保存中…" : "保存する"}
            </button>
            {saved && <span className="text-xs text-emerald-700">保存しました</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/plans", { cache: "no-store" });
    const data = await res.json();
    setPlans(data.plans || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleMove(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= plans.length) return;
    const reordered = [...plans];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setPlans(reordered);
    await fetch("/api/admin/plans/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((p) => p.id) }),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <AdminNav />
      <div>
        <h1 className="text-xl font-bold">プラン詳細編集</h1>
        <p className="text-sm text-black/50 mt-1">
          プランの名称・説明・料金・人数条件・受付開始タイミング・曜日別の確定方式・画像・表示順を編集できます。
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-black/40">読み込み中…</p>
      ) : (
        <div className="space-y-3">
          {plans.map((p, i) => (
            <PlanEditor
              key={p.id}
              plan={p}
              onSaved={load}
              onMoveUp={() => handleMove(i, -1)}
              onMoveDown={() => handleMove(i, 1)}
              isFirst={i === 0}
              isLast={i === plans.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
