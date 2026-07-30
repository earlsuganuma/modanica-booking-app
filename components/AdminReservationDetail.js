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
              <div>{reservation.guest_count}名</div>
            </div>
            <div className="space-y-1">
              <div className="text-black/40 text-xs">お客様名</div>
              <div>{reservation.customer_name}</div>
            </div>
            <div className="space-y-1">
              <div className="text-black/40 text-xs">連絡先</div>
              <div>{reservation.customer_email}{reservation.customer_tel ? ` / ${reservation.customer_tel}` : ""}</div>
            </div>
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
                    （{reservation.card_brand} 下4桁 {reservation.card_last4}）
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

          <div className="border-t border-black/10 pt-4 flex flex-wrap gap-2">
            {reservation.status !== "confirmed" && (
              <button
                onClick={() => updateStatus("confirmed")}
                disabled={updating}
                className="text-sm rounded-full bg-emerald-600 text-white px-5 py-2 hover:opacity-90 disabled:opacity-40"
              >
                確定する{reservation.payment_status === "authorized" ? "（決済確定）" : ""}
              </button>
            )}
            {reservation.status !== "pending_review" && (
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
                onClick={() => updateStatus("cancelled")}
                disabled={updating}
                className="text-sm rounded-full border border-red-300 text-red-600 px-5 py-2 hover:bg-red-50 disabled:opacity-40"
              >
                キャンセルする
                {reservation.payment_status === "captured" &&
                  `（規定に基づき¥${(reservation.estimated_refund_if_cancelled_now ?? 0).toLocaleString()}返金）`}
              </button>
            )}
            {reservation.status !== "cancelled" && reservation.payment_status === "captured" && (
              <button
                onClick={() => updateStatus("cancelled", { fullRefund: true })}
                disabled={updating}
                className="text-sm rounded-full border border-amber-300 text-amber-700 px-5 py-2 hover:bg-amber-50 disabled:opacity-40"
              >
                全額返金してキャンセル（当店都合）
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
