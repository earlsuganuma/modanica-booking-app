"use client";

import { useEffect, useMemo, useState } from "react";
import AdminNav from "../../components/AdminNav";

const STATUS_LABEL = {
  pending_review: "要確認",
  confirmed: "確定",
  visited: "来店済み",
  no_show: "未来店",
  cancelled: "キャンセル",
};
const STATUS_BADGE = {
  pending_review: "badge badge-manual",
  confirmed: "badge badge-confirmed",
  visited: "badge badge-confirmed",
  no_show: "badge badge-cancelled",
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
  const [otaList, setOtaList] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const today = todayDateStr();
    const [resReservations, resReport, resOta] = await Promise.all([
      fetch("/api/admin/reservations", { cache: "no-store" }),
      fetch(`/api/admin/reports/revenue?year=${today.slice(0, 4)}&month=${Number(today.slice(5, 7))}`, {
        cache: "no-store",
      }),
      // Booking.com・Airbnb など、OTA経由の予約（取得に失敗しても、ダッシュボードは表示する）
      fetch("/api/admin/ota-reservations", { cache: "no-store" }).catch(() => null),
    ]);
    const dataReservations = await resReservations.json();
    const dataReport = await resReport.json();
    let dataOta = {};
    try {
      dataOta = resOta && resOta.ok ? await resOta.json() : {};
    } catch (e) {
      dataOta = {};
    }
    setOtaList(dataOta.reservations || []);
    setReservations(dataReservations.reservations || []);
    setReport(dataReport);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(id, status) {
    const res = await fetch(`/api/admin/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      // 例：キャンセル済みの予約を戻そうとしたが、その日程が他の予約・OTAブロックで埋まっている
      const data = await res.json().catch(() => ({}));
      alert(data.message || "処理に失敗しました。");
    }
    load();
  }

  async function setOtaVisit(id, visitStatus) {
    const res = await fetch("/api/admin/ota-reservations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "visit_status", visitStatus }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.message || "処理に失敗しました。");
    }
    load();
  }

  const today = todayDateStr();
  const weekLater = addDaysStr(today, 7);

  // 自社予約とOTA予約を、日時順にまとめて表示する（OTAはチェックイン日の16:00として並べる）
  const todayList = useMemo(() => {
    const own = reservations
      .filter((r) => r.status !== "cancelled" && r.start_datetime.slice(0, 10) === today)
      .map((r) => ({ kind: "own", key: `own-${r.id}`, sort: r.start_datetime, r }));
    const ota = otaList
      .filter((b) => b.start_date === today)
      .map((b) => ({ kind: "ota", key: `ota-${b.id}`, sort: `${b.start_date}T16:00`, b }));
    return [...own, ...ota].sort((a, b) => a.sort.localeCompare(b.sort));
  }, [reservations, otaList, today]);

  const upcomingList = useMemo(() => {
    const own = reservations
      .filter(
        (r) =>
          r.status !== "cancelled" &&
          r.start_datetime.slice(0, 10) > today &&
          r.start_datetime.slice(0, 10) <= weekLater
      )
      .map((r) => ({ kind: "own", key: `own-${r.id}`, sort: r.start_datetime, r }));
    const ota = otaList
      .filter((b) => b.start_date > today && b.start_date <= weekLater)
      .map((b) => ({ kind: "ota", key: `ota-${b.id}`, sort: `${b.start_date}T16:00`, b }));
    return [...own, ...ota].sort((a, b) => a.sort.localeCompare(b.sort));
  }, [reservations, otaList, today, weekLater]);

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
            <span className={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</span>{" "}
            {r.room_stay_overlaps && r.room_stay_overlaps.length > 0 && (
              <span className="badge" style={{ background: "#fee2e2", color: "#991b1b" }} title={r.room_stay_overlaps.join("\n")}>
                要調整：同じ夜に小部屋の宿泊あり
              </span>
            )}
          </div>
          <div className="text-sm text-black/50">
            {r.start_datetime.slice(0, 10)} {r.start_datetime.slice(11, 16)} 〜 {r.end_datetime.slice(11, 16)}
          </div>
        </div>
        <div className="mt-2 text-sm text-black/60">
          お客様：{r.customer_name}（{r.guest_count}名） / ¥{r.total_price.toLocaleString()}
        </div>
        {r.room_stay_overlaps && r.room_stay_overlaps.length > 0 && (
          <div className="mt-1 text-xs text-red-700">同じ夜の小部屋の宿泊：{r.room_stay_overlaps.join("、")}</div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`/admin/reservations/${r.id}`} className="text-xs rounded-full border border-black/20 px-4 py-1.5 hover:bg-black/5">
            詳細を見る
          </a>
          {r.status !== "confirmed" && r.status !== "visited" && r.status !== "no_show" && (
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

  function OtaRow({ b }) {
    const reg = (b.registry || []).length > 0;
    return (
      <div className="rounded-2xl bg-white p-4 shadow-sm border-l-4 border-amber-400">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs rounded-full bg-amber-100 px-2 py-0.5">{b.channel_label}</span>
            <span className="font-bold">{b.room_label}</span>
            <span className={`text-xs rounded-full px-2 py-0.5 ${reg ? "bg-emerald-100 text-emerald-800" : "bg-black/5 text-black/50"}`}>
              {reg ? "名簿入力済み" : "名簿未入力"}
            </span>
            {b.visit_status === "visited" && <span className="badge badge-confirmed">来店済み</span>}
            {b.visit_status === "no_show" && <span className="badge badge-cancelled">未来店</span>}
          </div>
          <div className="text-sm text-black/50">
            {b.start_date} IN 〜 {b.end_date} OUT（{b.nights}泊）
          </div>
        </div>
        <div className="mt-2 text-sm text-black/60">
          お客様：{b.guest_name || "（未入力）"}
          {b.guest_count ? `（${b.guest_count}名）` : ""} / {b.total_price != null ? `¥${Number(b.total_price).toLocaleString()}` : "金額：未入力"}
          {b.booking_ref ? <span className="text-black/40"> / 予約番号 {b.booking_ref}</span> : null}
        </div>
        {b.memo ? <div className="mt-1 text-xs text-black/40 whitespace-pre-wrap line-clamp-3">{b.memo}</div> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/admin/reservations" className="text-xs rounded-full border border-black/20 px-4 py-1.5 hover:bg-black/5">
            予約一覧で詳細・名簿を見る
          </a>
          {b.visit_status !== "visited" && (
            <button
              onClick={() => setOtaVisit(b.id, "visited")}
              className="text-xs rounded-full bg-emerald-600 text-white px-4 py-1.5 hover:opacity-90"
            >
              来店済みにする
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
              <div className="text-xs text-black/40">今日の予約（OTA含む）</div>
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
              todayList.map((it) => (it.kind === "ota" ? <OtaRow key={it.key} b={it.b} /> : <ReservationRow key={it.key} r={it.r} />))
            )}
          </div>

          <div className="space-y-3">
            <h2 className="font-bold text-sm">今後7日間の予約（{upcomingList.length}件）</h2>
            {upcomingList.length === 0 ? (
              <p className="text-sm text-black/40">今後7日間の予約はありません。</p>
            ) : (
              upcomingList.map((it) => (it.kind === "ota" ? <OtaRow key={it.key} b={it.b} /> : <ReservationRow key={it.key} r={it.r} />))
            )}
          </div>
        </>
      )}
    </div>
  );
}
