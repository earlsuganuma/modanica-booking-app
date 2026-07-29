"use client";

import { useEffect, useMemo, useState } from "react";
import AdminNav from "../../../../components/AdminNav";

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

// year/month(1-12) のカレンダーグリッド（日曜始まり）を作る。前後月の日も埋める。
function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month - 1, 1);
  const startOffset = firstOfMonth.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${pad2(month)}-${pad2(d)}`);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export default function AdminReservationsCalendarPage() {
  const today = todayDateStr();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(today);

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

  const byDate = useMemo(() => {
    const map = {};
    for (const r of reservations) {
      const day = r.start_datetime.slice(0, 10);
      if (!map[day]) map[day] = [];
      map[day].push(r);
    }
    return map;
  }, [reservations]);

  const weeks = useMemo(() => buildMonthGrid(year, month), [year, month]);

  function goPrevMonth() {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  }
  function goNextMonth() {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  }

  async function updateStatus(id, status) {
    await fetch(`/api/admin/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  const selectedList = (byDate[selectedDate] || []).sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));

  return (
    <div className="space-y-6">
      <AdminNav />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">予約カレンダー</h1>
        <button onClick={load} className="text-xs underline text-black/40">再読み込み</button>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={goPrevMonth} className="rounded-full border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5">
          ← 前月
        </button>
        <div className="font-bold">{year}年{month}月</div>
        <button onClick={goNextMonth} className="rounded-full border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5">
          翌月 →
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-black/40">読み込み中…</p>
      ) : (
        <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 bg-black/5 text-xs text-black/50">
            {["日", "月", "火", "水", "木", "金", "土"].map((w) => (
              <div key={w} className="px-2 py-2 text-center">{w}</div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-t border-black/5">
              {week.map((day, di) => {
                if (!day) return <div key={di} className="min-h-[72px] border-l border-black/5 first:border-l-0" />;
                const list = byDate[day] || [];
                const pending = list.filter((r) => r.status === "pending_review").length;
                const confirmed = list.filter((r) => r.status === "confirmed").length;
                const isToday = day === today;
                const isSelected = day === selectedDate;
                return (
                  <button
                    key={di}
                    onClick={() => setSelectedDate(day)}
                    className={`min-h-[72px] border-l border-black/5 first:border-l-0 p-1.5 text-left align-top hover:bg-black/[0.03] ${
                      isSelected ? "bg-black/[0.06]" : ""
                    }`}
                  >
                    <div className={`text-xs ${isToday ? "font-bold text-ink" : "text-black/50"}`}>
                      {Number(day.slice(8, 10))}
                      {isToday && <span className="ml-1 text-[10px] text-emerald-600">今日</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {confirmed > 0 && (
                        <span className="text-[10px] rounded-full bg-emerald-100 text-emerald-700 px-1.5">確定{confirmed}</span>
                      )}
                      {pending > 0 && (
                        <span className="text-[10px] rounded-full bg-amber-100 text-amber-700 px-1.5">要確認{pending}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-bold text-sm">{selectedDate} の予約（{selectedList.length}件）</h2>
        {selectedList.length === 0 ? (
          <p className="text-sm text-black/40">この日の予約はありません。</p>
        ) : (
          selectedList.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white p-4 shadow-sm">
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
                  {r.start_datetime.slice(11, 16)} 〜 {r.end_datetime.slice(11, 16)}
                </div>
              </div>
              <div className="mt-2 text-sm text-black/60">
                お客様：{r.customer_name}（{r.guest_count}名） / ¥{r.total_price.toLocaleString()}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`/admin/reservations/${r.id}`}
                  className="text-xs rounded-full border border-black/20 px-4 py-1.5 hover:bg-black/5"
                >
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
                {r.status !== "cancelled" && (
                  <button
                    onClick={() => updateStatus(r.id, "cancelled")}
                    className="text-xs rounded-full border border-red-300 text-red-600 px-4 py-1.5 hover:bg-red-50"
                  >
                    キャンセル
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
