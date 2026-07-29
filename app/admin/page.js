"use client";

import { useEffect, useMemo, useState } from "react";
import AdminNav from "../../components/AdminNav";

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

function pad2(n) {
  return String(n).padStart(2, "0");
}
function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function addDaysStr(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export default function AdminDashboardPage() {
  const [reservations, setReservations] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const today = todayDateStr();
    const [resReservations, resReport] = await Promise.all([
      fetch("/api/admin/reservations", { cache: "no-store" }),
      fetch(`/api/admin/reports/revenue?year=${today.slice(0, 4)}&month=${Number(today.slice(5, 7))}`, {
        cache: "no-store",
      }),
    ]);
    const dataReservations = await resReservations.json();
    const dataReport = await resReport.json();
    setReservations(dataReservations.reservations || []);
    setReport(dataReport);
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

  const today = todayDateStr();
  const weekLater = addDaysStr(today, 7);

  const todayList = useMemo(
    () =>
      reservations
        .filter((r) => r.status !== "cancelled" && r.start_datetime.slice(0, 10) === today)
        .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime)),
    [reservations, today]
  );

  const upcomingList = useMemo(
    () =>
      reservations
        .filter(
          (r) =>
            r.status !== "cancelled" &&
            r.start_datetime.slice(0, 10) > today &&
            r.start_datetime.slice(0, 10) <= weekLater
        )
        .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime)),
    [reservations, today, weekLater]
  );

  const pendingCount = useMemo(
    () => reservations.filter((r) => r.status === "pending_review").length,
    [reservations]
  );

  function ReservationRow({ r }) {
    return (
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <a href={`/admin/reservations/${r.id}`} className="font-mono text-xs text-black/40 hover:underline">
              #{r.id}
            </a>{" "}
            <a href={`/admin/reservations/${r.id}`} className="font-bold hover:underline">
              {r.plan_name}
            </a>{" "}
            <span className={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</span>
          </div>
          <div className="text-sm text-black/50">
            {r.start_datetime.slice(0, 10)} {r.start_datetime.slice(11, 16)} 〜 {r.end_datetime.slice(11, 16)}
          </div>
        </div>
        <div className="mt-2 text-sm text-black/60">
          お客様：{r.customer_name}（{r.guest_count}名） / ¥{r.total_price.toLocaleString()}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`/admin/reservations/${r.id}`} className="text-xs rounded-full border border-black/20 px-4 py-1.5 hover:bg-black/5">
            詳細を見る
          </a>
          {r.status !== "confirmed" && (
            <button
              onClick={() => updateStatus(r.id, "confirmed")}
              className="text-xs rounded-full bg-emerald-600 text-white px-4 py-1.5 hover:opacity-90"
            >
              確定する
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminNav />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">ダッシュボード</h1>
        <button onClick={load} className="text-xs underline text-black/40">再読み込み</button>
      </div>

      {loading ? (
        <p className="text-sm text-black/40">読み込み中…</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="text-xs text-black/40">今日の予約</div>
              <div className="text-2xl font-bold mt-1">{todayList.length}件</div>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="text-xs text-black/40">要確認</div>
              <div className="text-2xl font-bold mt-1 text-amber-700">{pendingCount}件</div>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="text-xs text-black/40">今月の確定売上</div>
              <div className="text-2xl font-bold mt-1">¥{(report?.totals?.confirmed || 0).toLocaleString()}</div>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="text-xs text-black/40">今月の見込み売上</div>
              <div className="text-2xl font-bold mt-1 text-amber-700">
                ¥{(report?.totals?.pending_review || 0).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <a href="/admin/reservations" className="rounded-full border border-black/15 px-3 py-1.5 hover:bg-black/5">
              予約一覧をすべて見る
            </a>
            <a href="/admin/reservations/calendar" className="rounded-full border border-black/15 px-3 py-1.5 hover:bg-black/5">
              カレンダーで見る
            </a>
            <a href="/admin/reports" className="rounded-full border border-black/15 px-3 py-1.5 hover:bg-black/5">
              売上レポートを見る
            </a>
          </div>

          <div className="space-y-3">
            <h2 className="font-bold text-sm">今日の予約（{todayList.length}件）</h2>
            {todayList.length === 0 ? (
              <p className="text-sm text-black/40">今日の予約はありません。</p>
            ) : (
              todayList.map((r) => <ReservationRow key={r.id} r={r} />)
            )}
          </div>

          <div className="space-y-3">
            <h2 className="font-bold text-sm">今後7日間の予約（{upcomingList.length}件）</h2>
            {upcomingList.length === 0 ? (
              <p className="text-sm text-black/40">今後7日間の予約はありません。</p>
            ) : (
              upcomingList.map((r) => <ReservationRow key={r.id} r={r} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}
