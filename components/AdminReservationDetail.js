"use client";

import { useEffect, useState } from "react";
import AdminNav from "./AdminNav";

const STATUS_LABEL = {
  pending_review: "要確認",
  confirmed: "確定",
  cancelled: "キャンセル",
};
const STATUS_BADGE = {
  pending_review: "badge badge-manual",
  confirmed: "badge badge-confirmed",
  cancelled: "badge badge-cancelled",
};
const PAYMENT_STATUS_LABEL = {
  none: "決済なし",
  authorized: "与信確保済み（未確定）",
  captured: "支払い確定済み",
  released: "与信解放（未請求）",
  refunded: "全額返金済み",
  partially_refunded: "一部返金済み",
};

export default function AdminReservationDetail({ id }) {
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [actionError, setActionError] = useState(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/reservations/${id}`, { cache: "no-store" });
    if (res.status === 404) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setReservation(data.reservation);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 予約内容の編集（お客様情報・備考・宿泊者の内訳）
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setActionError(null);
    setForm({
      customerName: reservation.customer_name || "",
      customerEmail: reservation.customer_email || "",
      customerTel: reservation.customer_tel || "",
      customerAddress: reservation.customer_address || "",
      note: reservation.note || "",
      guestMale: reservation.guest_male ?? 0,
      guestFemale: reservation.guest_female ?? 0,
      guestChildren: reservation.guest_children ?? 0,
    });
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    setActionError(null);
    const edit = { ...form };
    if (!reservation.is_stay_plan || reservation.guest_female == null) {
      delete edit.guestMale;
      delete edit.guestFemale;
      delete edit.guestChildren;
    }
    const res = await fetch(`/api/admin/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ edit }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.message || "保存に失敗しました。");
      setSaving(false);
      return;
    }
    setEditing(false);
    await load();
    setSaving(false);
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function updateStatus(status, options = {}) {
    setUpdating(true);
    setActionError(null);
    const res = await fetch(`/api/admin/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...options }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.message || "処理に失敗しました。");
      setUpdating(false);
      return;
    }
    await load();
    setUpdating(false);
  }

  return (
    <div className="space-y-6">
      <AdminNav />
      <div className="text-xs text-black/40">
        <a href="/admin/reservations" className="hover:underline">予約一覧</a> / 予約詳細
      </div>

      {loading ? (
        <p className="text-sm text-black/40">読み込み中…</p>
      ) : notFound || !reservation ? (
        <p className="text-sm text-black/40">予約が見つかりませんでした。</p>
      ) : (
        <div className="rounded-2xl bg-white p-6 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-black/40">#{reservation.id}</span>
              <h1 className="text-lg font-bold">{reservation.plan_name}</h1>
              <span className={STATUS_BADGE[reservation.status]}>{STATUS_LABEL[reservation.status]}</span>
              {reservation.at_risk && (
                <span className="badge" style={{ background: "#fef3c7", color: "#92400e" }}>
                  仮予約（優先予約の受付期間中）
                </span>
              )}
            </div>
            <div className="text-sm text-black/50">
              受付日時：{reservation.created_at ? new Date(reservation.created_at).toLocaleString("ja-JP") : "-"}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-black/40 text-xs">利用日時</div>
              <div>{reservation.start_datetime.replace("T", " ")} 〜 {reservation.end_datetime.replace("T", " ")}</div>
            </div>
            <div className="space-y-1">
              <div className="text-black/40 text-xs">人数</div>
              <div>
                {reservation.guest_count}名
                {reservation.guest_male != null && (
                  <span className="text-black/40 text-xs">
                    {" "}
                    （男性{reservation.guest_male}・女性{reservation.guest_female}・子供{reservation.guest_children}）
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-black/40 text-xs">お客様名</div>
              <div>
                {reservation.customer_name}
                {reservation.repeat_count > 0 && (
                  <span
                    className="badge ml-2"
                    style={{ background: "#fce7f3", color: "#9d174d" }}
                    title="同じ電話番号の過去の予約があります"
                  >
                    リピーター（過去{reservation.repeat_count}回の予約あり）
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-black/40 text-xs">連絡先</div>
              <div>{reservation.customer_email}{reservation.customer_tel ? ` / ${reservation.customer_tel}` : ""}</div>
            </div>
            {reservation.customer_address && (
              <div className="space-y-1">
                <div className="text-black/40 text-xs">ご住所</div>
                <div>{reservation.customer_address}</div>
              </div>
            )}
            <div className="space-y-1">
              <div className="text-black/40 text-xs">金額</div>
              <div className="font-bold">¥{reservation.total_price.toLocaleString()}</div>
            </div>
            <div className="space-y-1">
              <div className="text-black/40 text-xs">決済状況</div>
              <div>
                {PAYMENT_STATUS_LABEL[reservation.payment_status] || reservation.payment_status}
                {reservation.card_brand && (
                  <span className="text-black/40 text-xs">
                    {" "}
                    （{reservation.card_brand}
                    {reservation.card_last4 ? ` 下4桁 ${reservation.card_last4}` : ""}）
                  </span>
                )}
                {reservation.refunded_amount > 0 && (
                  <span className="block text-xs text-black/40">
                    返金済み：¥{reservation.refunded_amount.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-black/40 text-xs">オプション</div>
              <div>
                {reservation.options && reservation.options.length > 0
                  ? reservation.options
                      .map((o) => (o.unit === "quantity" ? `${o.name} ×${o.quantity ?? 1}${o.unitLabel || "個"}` : o.name))
                      .join("、")
                  : "なし"}
              </div>
            </div>
          </div>

          {reservation.note && (
            <div className="space-y-1 text-sm">
              <div className="text-black/40 text-xs">備考</div>
              <div className="whitespace-pre-wrap">{reservation.note}</div>
            </div>
          )}

          {actionError && (
            <div className="text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3">{actionError}</div>
          )}

          {editing && form ? (
            <div className="rounded-xl border border-black/10 p-4 space-y-3 bg-black/[0.02]">
              <h2 className="font-bold text-sm">予約内容の編集</h2>
              <p className="text-xs text-black/40">
                お客様情報・備考を編集できます。日程・人数・オプション・金額は変更できません（変更が必要な場合は、キャンセルして新しく予約を作成してください）。
                変更しても、お客様へのメールは送信されません。
              </p>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <label className="block">
                  <span className="text-black/50 text-xs">お名前</span>
                  <input value={form.customerName} onChange={(e) => setField("customerName", e.target.value)} className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" />
                </label>
                <label className="block">
                  <span className="text-black/50 text-xs">メールアドレス（任意）</span>
                  <input value={form.customerEmail} onChange={(e) => setField("customerEmail", e.target.value)} className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" />
                </label>
                <label className="block">
                  <span className="text-black/50 text-xs">電話番号</span>
                  <input value={form.customerTel} onChange={(e) => setField("customerTel", e.target.value)} className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" />
                </label>
                {(reservation.is_stay_plan || reservation.customer_address) && (
                  <label className="block">
                    <span className="text-black/50 text-xs">ご住所{reservation.is_stay_plan ? "（宿泊者名簿のため必須）" : ""}</span>
                    <input value={form.customerAddress} onChange={(e) => setField("customerAddress", e.target.value)} className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" />
                  </label>
                )}
              </div>
              {reservation.is_stay_plan && reservation.guest_female != null && (
                <div>
                  <span className="text-black/50 text-xs">宿泊者の内訳（合計は{reservation.guest_count}名のまま）</span>
                  <div className="mt-1 grid grid-cols-3 gap-3 text-sm">
                    {reservation.shows_male_guests && (
                      <label className="block">
                        <span className="text-black/40 text-xs">男性</span>
                        <input type="number" min="0" value={form.guestMale} onChange={(e) => setField("guestMale", e.target.value)} className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" />
                      </label>
                    )}
                    <label className="block">
                      <span className="text-black/40 text-xs">女性</span>
                      <input type="number" min="0" value={form.guestFemale} onChange={(e) => setField("guestFemale", e.target.value)} className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" />
                    </label>
                    <label className="block">
                      <span className="text-black/40 text-xs">子供</span>
                      <input type="number" min="0" value={form.guestChildren} onChange={(e) => setField("guestChildren", e.target.value)} className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" />
                    </label>
                  </div>
                </div>
              )}
              <label className="block text-sm">
                <span className="text-black/50 text-xs">備考</span>
                <textarea value={form.note} onChange={(e) => setField("note", e.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" />
              </label>
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={saving} className="text-sm rounded-full bg-ink text-white px-5 py-2 hover:opacity-90 disabled:opacity-40">
                  {saving ? "保存中…" : "保存する"}
                </button>
                <button onClick={() => setEditing(false)} disabled={saving} className="text-sm rounded-full border border-black/20 px-5 py-2 hover:bg-black/5 disabled:opacity-40">
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button onClick={startEdit} className="text-xs rounded-full border border-black/20 px-4 py-1.5 hover:bg-black/5">
                予約内容を編集する
              </button>
            </div>
          )}

          <div className="border-t border-black/10 pt-4 flex flex-wrap gap-2">
            {reservation.status === "cancelled" && reservation.payment_status !== "none" && (
              <p className="text-xs text-black/40 w-full">
                決済のある予約はキャンセル後に元へ戻せません。再度ご利用の場合は、新しく予約を作成してください。
              </p>
            )}
            {reservation.status !== "confirmed" && !(reservation.status === "cancelled" && reservation.payment_status !== "none") && (
              <button
                onClick={() => updateStatus("confirmed")}
                disabled={updating}
                className="text-sm rounded-full bg-emerald-600 text-white px-5 py-2 hover:opacity-90 disabled:opacity-40"
              >
                確定する{reservation.payment_status === "authorized" ? "（決済確定）" : ""}
              </button>
            )}
            {reservation.status !== "pending_review" && !(reservation.status === "cancelled" && reservation.payment_status !== "none") && (
              <button
                onClick={() => updateStatus("pending_review")}
                disabled={updating}
                className="text-sm rounded-full border border-black/20 px-5 py-2 hover:bg-black/5 disabled:opacity-40"
              >
                要確認に戻す
              </button>
            )}
            {reservation.status !== "cancelled" && (
              <button
                onClick={() => {
                  const refund = reservation.payment_status === "captured" ? (reservation.estimated_refund_if_cancelled_now ?? 0) : null;
                  const msg =
                    refund != null
                      ? `お客様都合でキャンセルします。キャンセルポリシーに基づき ¥${refund.toLocaleString()} を返金します（残りはキャンセル料）。よろしいですか？`
                      : "この予約をキャンセルします。よろしいですか？";
                  if (window.confirm(msg)) updateStatus("cancelled");
                }}
                disabled={updating}
                className="text-sm rounded-full border border-red-300 text-red-600 px-5 py-2 hover:bg-red-50 disabled:opacity-40"
              >
                {reservation.payment_status === "captured"
                  ? `お客様都合でキャンセル（規定に基づき¥${(reservation.estimated_refund_if_cancelled_now ?? 0).toLocaleString()}返金）`
                  : "キャンセルする"}
              </button>
            )}
            {reservation.status !== "cancelled" && reservation.payment_status === "captured" && (
              <button
                onClick={() => {
                  if (window.confirm(`当店都合でキャンセルします。全額 ¥${(reservation.refundable_remaining ?? 0).toLocaleString()} を返金します。よろしいですか？`)) {
                    updateStatus("cancelled", { fullRefund: true });
                  }
                }}
                disabled={updating}
                className="text-sm rounded-full border border-amber-300 text-amber-700 px-5 py-2 hover:bg-amber-50 disabled:opacity-40"
              >
                当店都合でキャンセル（全額返金）
              </button>
            )}
            {reservation.status === "cancelled" && reservation.refundable_remaining > 0 && (
              <button
                onClick={async () => {
                  if (!window.confirm(`残額 ¥${reservation.refundable_remaining.toLocaleString()} を返金します（キャンセル料を請求しない場合）。よろしいですか？`)) return;
                  setUpdating(true);
                  setActionError(null);
                  const res = await fetch(`/api/admin/reservations/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refundRemaining: true }),
                  });
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    setActionError(data.message || "返金に失敗しました。");
                  }
                  await load();
                  setUpdating(false);
                }}
                disabled={updating}
                className="text-sm rounded-full border border-amber-300 text-amber-700 px-5 py-2 hover:bg-amber-50 disabled:opacity-40"
              >
                残額¥{reservation.refundable_remaining.toLocaleString()}を返金する
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
