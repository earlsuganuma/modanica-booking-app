"use client";

import { useEffect, useState } from "react";
import AdminNav from "../../../components/AdminNav";

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

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/reservations", { cache: "no-store" });
    const data = await res.json();
    setReservations(data.reservations || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(id, status) {
    await fetch(`/api/admin/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  const filtered = reservations.filter((r) => (filter === "all" ? true : r.status === filter));

  return (
    <div className="space-y-6">
      <AdminNav />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">予約一覧</h1>
        <button onClick={load} className="text-xs underline text-black/40">再読み込み</button>
      </div>

      <div className="flex gap-2 text-xs">
        {["all", "pending_review", "confirmed", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 border ${
              filter === s ? "bg-ink text-white border-ink" : "border-black/20 text-black/50"
            }`}
          >
            {s === "all" ? "すべて" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-black/40">読み込み中…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-black/40">予約はまだありません。</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <a href={`/admin/reservations/${r.id}`} className="font-mono text-xs text-black/40 hover:underline">
                    #{r.id}
                  </a>{" "}
                  <a href={`/admin/reservations/${r.id}`} className="font-bold hover:underline">
                    {r.plan_name}
                  </a>{" "}
                  <span className={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</span>{" "}
                  {r.at_risk && (
                    <span
                      className="badge"
                      style={{ background: "#fef3c7", color: "#92400e" }}
                      title="宿泊・施設貸切プランの最終受付期限が過ぎるまでは、優先予約が入り日程調整をお願いする可能性があります。"
                    >
                      仮予約（優先予約の受付期間中）
                    </span>
                  )}
                </div>
                <div className="text-sm text-black/50">
                  {r.start_datetime.replace("T", " ")} 〜 {r.end_datetime.replace("T", " ")}
                </div>
              </div>
              <div className="mt-2 grid sm:grid-cols-3 gap-2 text-sm text-black/60">
                <div>お客様：{r.customer_name}（{r.guest_count}名）</div>
                <div>連絡先：{r.customer_email} {r.customer_tel}</div>
                <div>金額：¥{r.total_price.toLocaleString()}</div>
              </div>
              {r.options && r.options.length > 0 && (
                <div className="mt-1 text-xs text-black/40">
                  オプション：
                  {r.options
                    .map((o) => (o.unit === "quantity" ? `${o.name} ×${o.quantity ?? 1}${o.unitLabel || "個"}` : o.name))
                    .join("、")}
                </div>
              )}
              {r.note && <div className="mt-1 text-xs text-black/40">備考：{r.note}</div>}

              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <a
                  href={`/admin/reservations/${r.id}`}
                  className="text-xs rounded-full border border-black/20 px-4 py-1.5 hover:bg-black/5"
                >
                  詳細を見る
                </a>
                {r.status !== "cancelled" && (
                  <>
                    {r.status !== "confirmed" && (
                      <button
                        onClick={() => updateStatus(r.id, "confirmed")}
                        className="text-xs rounded-full bg-emerald-600 text-white px-4 py-1.5 hover:opacity-90"
                      >
                        確定する
                      </button>
                    )}
                    {r.status !== "pending_review" && (
                      <button
                        onClick={() => updateStatus(r.id, "pending_review")}
                        className="text-xs rounded-full border border-black/20 px-4 py-1.5 hover:bg-black/5"
                      >
                        要確認に戻す
                      </button>
                    )}
                    <button
                      onClick={() => updateStatus(r.id, "cancelled")}
                      className="text-xs rounded-full border border-red-300 text-red-600 px-4 py-1.5 hover:bg-red-50"
                    >
                      キャンセル
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
