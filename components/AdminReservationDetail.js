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

export default function AdminReservationDetail({ id }) {
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [updating, setUpdating] = useState(false);

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

  async function updateStatus(status) {
    setUpdating(true);
    await fetch(`/api/admin/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
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

          <div className="border-t border-black/10 pt-4 flex flex-wrap gap-2">
            {reservation.status !== "confirmed" && (
              <button
                onClick={() => updateStatus("confirmed")}
                disabled={updating}
                className="text-sm rounded-full bg-emerald-600 text-white px-5 py-2 hover:opacity-90 disabled:opacity-40"
              >
                確定する
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
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
