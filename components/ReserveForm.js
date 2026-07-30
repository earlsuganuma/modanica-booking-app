"use client";

import { useMemo, useState } from "react";
import TimeAxis from "./TimeAxis";

const SLOT3_OPTIONS = [
  { id: "slot_am", label: "1部（11:00〜16:00）" },
  { id: "slot_pm", label: "2部（17:00〜22:00）" },
  { id: "slot_full", label: "1日（11:00〜22:00）" },
];

function slot3OptionsWithPrice(plan) {
  return SLOT3_OPTIONS.map((s) => {
    const price = plan.slot_prices ? plan.slot_prices[s.id] : null;
    return { ...s, label: price != null ? `${s.label}｜¥${price.toLocaleString()}〜` : s.label };
  });
}

export default function ReserveForm({ plan }) {
  const slotOptions = slot3OptionsWithPrice(plan);
  const [date, setDate] = useState("");
  const [slotId, setSlotId] = useState(SLOT3_OPTIONS[2].id);
  const [startTime, setStartTime] = useState("11:00");
  const [endTime, setEndTime] = useState("13:00");
  const [guestCount, setGuestCount] = useState(plan.min_guests || 1);
  const [optionIds, setOptionIds] = useState(
    plan.options.filter((o) => o.unit !== "quantity" && o.is_default).map((o) => o.id)
  );
  const [optionQuantities, setOptionQuantities] = useState(
    Object.fromEntries(
      plan.options.filter((o) => o.unit === "quantity" && o.is_default).map((o) => [o.id, 1])
    )
  );
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerTel, setCustomerTel] = useState("");
  const [note, setNote] = useState("");
  const [agreedToPriorityClause, setAgreedToPriorityClause] = useState(false);
  const requiresPriorityClause = plan.category === "cafe";

  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const payloadBase = useMemo(
    () => ({
      planId: plan.id,
      date,
      slotId: plan.time_type === "slot3" ? slotId : undefined,
      startTime: plan.time_type === "flexible" ? startTime : undefined,
      endTime: plan.time_type === "flexible" ? endTime : undefined,
      guestCount: Number(guestCount),
      optionIds,
      optionQuantities,
    }),
    [plan, date, slotId, startTime, endTime, guestCount, optionIds, optionQuantities]
  );

  async function checkAvailability() {
    if (!date) return;
    setChecking(true);
    setAvailability(null);
    setError(null);
    try {
      const res = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBase),
      });
      const data = await res.json();
      setAvailability(data);
    } catch (e) {
      setError("空き状況の確認に失敗しました。");
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (requiresPriorityClause && !agreedToPriorityClause) {
      setError("確認事項へのご同意にチェックしてください。");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payloadBase, customerName, customerEmail, customerTel, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "予約の作成に失敗しました。日程をご確認ください。");
        setSubmitting(false);
        return;
      }
      window.location.href = `/complete/${data.reservationId}`;
    } catch (e) {
      setError("予約の作成に失敗しました。");
      setSubmitting(false);
    }
  }

  function toggleOption(id) {
    setOptionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function setOptionQuantity(id, value, max) {
    let qty = Math.max(0, Number(value) || 0);
    if (max != null) qty = Math.min(qty, max);
    setOptionQuantities((prev) => ({ ...prev, [id]: qty }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-bold">日程・人数</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-black/50">利用日</span>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="text-black/50">人数</span>
            <input
              type="number"
              min={plan.min_guests || 1}
              max={plan.max_guests || 99}
              required
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </label>
        </div>

        {(plan.time_type === "slot3" || plan.time_type === "flexible") && (
          <TimeAxis resourceIds={plan.resources.map((r) => r.id)} date={date} />
        )}

        {plan.time_type === "slot3" && (
          <label className="block text-sm">
            <span className="text-black/50">利用時間帯（1部／2部／1日）</span>
            <select
              value={slotId}
              onChange={(e) => setSlotId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            >
              {slotOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
        )}

        {plan.time_type === "flexible" && (
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="text-black/50">開始時刻</span>
              <input
                type="time"
                min="11:00"
                max="22:00"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-black/50">終了時刻</span>
              <input
                type="time"
                min="11:00"
                max="22:00"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
              />
            </label>
            <p className="text-xs text-black/40 sm:col-span-2">営業時間 11:00〜22:00 の範囲でご指定ください。</p>
          </div>
        )}

        {(plan.time_type === "stay_11_11" || plan.time_type === "stay_18_11" || plan.time_type === "stay_16_11") && (
          <p className="text-xs text-black/40">
            {plan.time_type === "stay_11_11" && "チェックイン 11:00 / チェックアウト 翌11:00"}
            {plan.time_type === "stay_18_11" && "チェックイン 18:00 / チェックアウト 翌11:00"}
            {plan.time_type === "stay_16_11" && "チェックイン 16:00 / チェックアウト 翌11:00"}
          </p>
        )}

        {plan.options.length > 0 && (
          <div>
            <span className="text-sm text-black/50">オプション</span>
            <div className="mt-2 space-y-2">
              {plan.options.map((o) =>
                o.unit === "quantity" ? (
                  <div key={o.id} className="flex items-center gap-3 text-sm">
                    <span className="flex-1">
                      {o.name}
                      <span className="text-black/40">
                        {" "}
                        （{o.price ? `¥${o.price.toLocaleString()}／${o.unitLabel || "個"}` : "無料"}）
                      </span>
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={o.maxQuantity ?? undefined}
                      value={optionQuantities[o.id] ?? 0}
                      onChange={(e) => setOptionQuantity(o.id, e.target.value, o.maxQuantity)}
                      className="w-20 rounded-lg border border-black/15 px-3 py-1.5"
                    />
                    <span className="text-black/40 text-xs">{o.unitLabel || "個"}</span>
                  </div>
                ) : (
                  <label key={o.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={optionIds.includes(o.id)}
                      onChange={() => toggleOption(o.id)}
                    />
                    <span>{o.name}</span>
                    <span className="text-black/40">{o.price ? `+¥${o.price.toLocaleString()}` : "無料"}</span>
                  </label>
                )
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={checkAvailability}
          disabled={!date || checking}
          className="text-sm rounded-full border border-ink px-4 py-2 hover:bg-black/5 disabled:opacity-40"
        >
          {checking ? "確認中…" : "空き状況・料金を確認"}
        </button>

        {availability && (
          <div
            className={`text-sm rounded-lg px-4 py-3 ${
              availability.available
                ? "bg-emerald-50 text-emerald-800"
                : availability.conflictType === "adjustable"
                ? "bg-amber-50 text-amber-800"
                : "bg-red-50 text-red-700"
            }`}
          >
            {availability.available ? (
              <>
                空きがあります。目安料金：¥{availability.price.total.toLocaleString()}
                {availability.price.optionBreakdown?.length > 0 && (
                  <span className="block text-xs mt-1 text-emerald-700">
                    内訳：
                    {availability.price.optionBreakdown
                      .map((o) => `${o.name}${o.unit === "quantity" ? `×${o.quantity}${o.unitLabel || "個"}` : ""} ¥${o.subtotal.toLocaleString()}`)
                      .join("、")}
                  </span>
                )}
                {availability.price.appliedRules?.some((r) => r.length > 0) && (
                  <span className="block text-xs mt-1 text-emerald-700">
                    適用ルール：{[...new Set(availability.price.appliedRules.flat())].join("、")}
                  </span>
                )}
              </>
            ) : (
              availability.reason || "この日程は予約できません。"
            )}
          </div>
        )}
      </div>

      {requiresPriorityClause && (
        <div className="rounded-2xl bg-white p-6 shadow-sm space-y-3">
          <h2 className="font-bold">確認事項</h2>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={agreedToPriorityClause}
              onChange={(e) => setAgreedToPriorityClause(e.target.checked)}
              className="mt-1"
              required
            />
            <span className="text-black/70">
              下記内容を確認・了承した
              <span className="block mt-1 text-xs text-black/50">
                本予約フォームはカフェ・飲食利用のご予約です。ご予約確定後であっても、宿泊・施設貸切のご予約が
                優先的に確定した場合、日程の変更をお願いすることがございます。該当する場合は、遅くともご利用日の
                2営業日前までにご連絡いたします。日程変更をお願いする際は、次回ご利用時にお使いいただける割引
                クーポンをご用意いたします。ご不便をおかけしますが、あらかじめご理解・ご了承のほど
                よろしくお願いいたします。
              </span>
            </span>
          </label>
        </div>
      )}

      <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-bold">お客様情報</h2>
        <label className="block text-sm">
          <span className="text-black/50">お名前</span>
          <input
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-black/50">メールアドレス</span>
          <input
            type="email"
            required
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-black/50">電話番号</span>
          <input
            value={customerTel}
            onChange={(e) => setCustomerTel(e.target.value)}
            className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-black/50">ご要望・備考</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
          />
        </label>
      </div>

      {error && <div className="text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3">{error}</div>}

      <button
        type="submit"
        disabled={submitting || (requiresPriorityClause && !agreedToPriorityClause)}
        className="w-full rounded-full bg-ink text-white px-6 py-3 font-semibold hover:opacity-90 disabled:opacity-40"
      >
        {submitting ? "送信中…" : "この内容で予約する（要確認）"}
      </button>
      <p className="text-xs text-black/40 text-center">
        送信後は「要確認」ステータスとなり、担当者が確認のうえ確定のご連絡をいたします。
      </p>
      <p className="text-xs text-black/40 text-center">
        ご予約は
        <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="underline">
          利用規約（キャンセルポリシーを含む）
        </a>
        に同意のうえお申し込みいただいたものとみなします。
      </p>
    </form>
  );
}
