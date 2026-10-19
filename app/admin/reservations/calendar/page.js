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
const STATUS_BAR = {
  pending_review: "#f59e0b",
  confirmed: "#10b981",
  cancelled: "#9ca3af",
};

// プランごとの色（背景・文字）。プランの並び順で割り当てる。
const PLAN_COLORS = [
  ["#dbeafe", "#1e40af"],
  ["#fce7f3", "#9d174d"],
  ["#dcfce7", "#166534"],
  ["#fef3c7", "#92400e"],
  ["#ede9fe", "#5b21b6"],
  ["#cffafe", "#155e75"],
  ["#ffedd5", "#9a3412"],
  ["#e0e7ff", "#3730a3"],
  ["#fae8ff", "#86198f"],
  ["#ecfccb", "#3f6212"],
];

const MAX_LINES_PER_CELL = 4;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
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

// プラン名を、マスに収まる長さに短縮する（「（8名以上）」などの補足は省く）。
function shortPlanName(name) {
  const base = String(name || "").replace(/（.*?）|\(.*?\)/g, "").trim() || String(name || "");
  return base.length > 8 ? `${base.slice(0, 8)}…` : base;
}

export default function AdminReservationsCalendarPage() {
  const today = todayDateStr();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState("plan"); // "plan" | "individual"
  const [showCancelled, setShowCancelled] = useState(false);
  const [planFilter, setPlanFilter] = useState("all");

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

  // プランの一覧と色（予約に出てくるプラン、ID順）
  const plans = useMemo(() => {
    const map = new Map();
    for (const r of reservations) {
      if (!map.has(r.plan_id)) map.set(r.plan_id, r.plan_name);
    }
    return [...map.entries()]
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }))
      .map(([id, name], i) => ({ id, name, color: PLAN_COLORS[i % PLAN_COLORS.length] }));
  }, [reservations]);
  const planColor = useMemo(() => Object.fromEntries(plans.map((p) => [p.id, p.color])), [plans]);

  // 日付ごとの予約。複数泊の予約は、チェックアウト日の前日まで毎日表示する（継続日はisStart=false）。
  const byDate = useMemo(() => {
    const map = {};
    for (const r of reservations) {
      if (!showCancelled && r.status === "cancelled") continue;
      if (planFilter !== "all" && r.plan_id !== planFilter) continue;
      const startDay = r.start_datetime.slice(0, 10);
      const endDay = r.end_datetime.slice(0, 10);
      const days = [startDay];
      for (let d = addDays(startDay, 1); d < endDay; d = addDays(d, 1)) days.push(d);
      days.forEach((day, i) => {
        if (!map[day]) map[day] = [];
        map[day].push({ r, isStart: i === 0 });
      });
    }
    for (const day of Object.keys(map)) {
      map[day].sort((a, b) => a.r.start_datetime.localeCompare(b.r.start_datetime));
    }
    return map;
  }, [reservations, showCancelled, planFilter]);

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

  const selectedEntries = byDate[selectedDate] || [];

  // マスの中身：プラン表示 = プランごとの件数、個別表示 = 予約を1件ずつ
  function renderPlanView(entries) {
    const groups = new Map();
    for (const { r } of entries) {
      if (!groups.has(r.plan_id)) groups.set(r.plan_id, { name: r.plan_name, count: 0, pending: 0, id: r.plan_id });
      const g = groups.get(r.plan_id);
      g.count += 1;
      if (r.status === "pending_review") g.pending += 1;
    }
    const list = [...groups.values()];
    const shown = list.slice(0, MAX_LINES_PER_CELL);
    return (
      <div className="mt-1 space-y-0.5">
        {shown.map((g) => {
          const [bg, fg] = planColor[g.id] || PLAN_COLORS[0];
          return (
            <div
              key={g.id}
              className="text-[10px] leading-tight rounded px-1 py-0.5 truncate"
              style={{ background: bg, color: fg }}
              title={`${g.name}：${g.count}件${g.pending ? `（うち要確認${g.pending}件）` : ""}`}
            >
              {shortPlanName(g.name)} ×{g.count}
              {g.pending > 0 && <span style={{ color: "#b45309" }}> ●</span>}
            </div>
          );
        })}
        {list.length > shown.length && <div className="text-[10px] text-black/40">ほか{list.length - shown.length}プラン</div>}
      </div>
    );
  }

  function renderIndividualView(entries) {
    const shown = entries.slice(0, MAX_LINES_PER_CELL);
    return (
      <div className="mt-1 space-y-0.5">
        {shown.map(({ r, isStart }) => {
          const [bg, fg] = planColor[r.plan_id] || PLAN_COLORS[0];
          return (
            <div
              key={`${r.id}-${isStart ? "s" : "c"}`}
              className="text-[10px] leading-tight rounded-r px-1 py-0.5 truncate"
              style={{
                background: bg,
                color: fg,
                borderLeft: `3px solid ${STATUS_BAR[r.status]}`,
                opacity: r.status === "cancelled" ? 0.5 : 1,
                textDecoration: r.status === "cancelled" ? "line-through" : "none",
              }}
              title={`#${r.id} ${r.plan_name} ${r.customer_name}（${r.guest_count}名）${STATUS_LABEL[r.status]}`}
            >
              {isStart ? r.start_datetime.slice(11, 16) : "宿泊中"} {r.customer_name} {r.guest_count}名
            </div>
          );
        })}
        {entries.length > shown.length && <div className="text-[10px] text-black/40">ほか{entries.length - shown.length}件</div>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminNav />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">予約カレンダー</h1>
        <button onClick={load} className="text-xs underline text-black/40">再読み込み</button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="inline-flex rounded-full border border-black/15 overflow-hidden">
          <button
            onClick={() => setView("plan")}
            className={`px-4 py-1.5 ${view === "plan" ? "bg-ink text-white" : "hover:bg-black/5"}`}
          >
            プラン表示
          </button>
          <button
            onClick={() => setView("individual")}
            className={`px-4 py-1.5 ${view === "individual" ? "bg-ink text-white" : "hover:bg-black/5"}`}
          >
            個別表示
          </button>
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="rounded-full border border-black/15 px-3 py-1.5"
        >
          <option value="all">すべてのプラン</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-1.5 text-black/60">
          <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
          キャンセルも表示
        </label>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-black/50">
        {view === "plan" ? (
          <>
            <span>プランごとの色で件数を表示（<span style={{ color: "#b45309" }}>●</span> は要確認を含む）</span>
          </>
        ) : (
          <>
            <span><span className="inline-block w-2 h-3 align-middle mr-1" style={{ background: STATUS_BAR.confirmed }} />確定</span>
            <span><span className="inline-block w-2 h-3 align-middle mr-1" style={{ background: STATUS_BAR.pending_review }} />要確認</span>
            {showCancelled && (
              <span><span className="inline-block w-2 h-3 align-middle mr-1" style={{ background: STATUS_BAR.cancelled }} />キャンセル</span>
            )}
            <span>色はプラン（左の帯が状態）／宿泊は泊まる日すべてに「宿泊中」と表示</span>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {plans.map((p) => (
          <span
            key={p.id}
            className="text-[10px] rounded-full px-2 py-0.5"
            style={{ background: p.color[0], color: p.color[1] }}
          >
            {shortPlanName(p.name)}
          </span>
        ))}
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
            {["日", "月", "火", "水", "木", "金", "土"].map((w, i) => (
              <div key={w} className="px-2 py-2 text-center" style={{ color: i === 0 ? "#dc2626" : i === 6 ? "#2563eb" : undefined }}>
                {w}
              </div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-t border-black/5">
              {week.map((day, di) => {
                if (!day) return <div key={di} className="min-h-[110px] border-l border-black/5 first:border-l-0" />;
                const entries = byDate[day] || [];
                const isToday = day === today;
                const isSelected = day === selectedDate;
                return (
                  <button
                    key={di}
                    onClick={() => setSelectedDate(day)}
                    className={`min-h-[110px] min-w-0 border-l border-black/5 first:border-l-0 p-1.5 text-left align-top hover:bg-black/[0.03] ${
                      isSelected ? "bg-black/[0.06]" : ""
                    }`}
                  >
                    <div
                      className={`text-xs ${isToday ? "font-bold text-ink" : "text-black/50"}`}
                      style={{ color: !isToday && di === 0 ? "#dc2626" : !isToday && di === 6 ? "#2563eb" : undefined }}
                    >
                      {Number(day.slice(8, 10))}
                      {isToday && <span className="ml-1 text-[10px] text-emerald-600">今日</span>}
                    </div>
                    {entries.length > 0 && (view === "plan" ? renderPlanView(entries) : renderIndividualView(entries))}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-bold text-sm">{selectedDate} の予約（{selectedEntries.length}件）</h2>
        {selectedEntries.length === 0 ? (
          <p className="text-sm text-black/40">この日の予約はありません。</p>
        ) : (
          selectedEntries.map(({ r, isStart }) => {
            const [bg, fg] = planColor[r.plan_id] || PLAN_COLORS[0];
            return (
              <div key={`${r.id}-${isStart ? "s" : "c"}`} className="rounded-2xl bg-white p-4 shadow-sm" style={{ borderLeft: `5px solid ${fg}` }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <a href={`/admin/reservations/${r.id}`} className="font-mono text-xs text-black/40 hover:underline">
                      #{r.id}
                    </a>{" "}
                    <a href={`/admin/reservations/${r.id}`} className="font-bold hover:underline">
                      {r.plan_name}
                    </a>{" "}
                    <span className={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</span>
                    {!isStart && <span className="ml-1 text-xs rounded-full px-2 py-0.5" style={{ background: bg, color: fg }}>宿泊中</span>}
                  </div>
                  <div className="text-sm text-black/50">
                    {r.start_datetime.replace("T", " ")} 〜 {r.end_datetime.replace("T", " ")}
                  </div>
                </div>
                <div className="mt-2 text-sm text-black/60">
                  お客様：{r.customer_name}（{r.guest_count}名） / ¥{r.total_price.toLocaleString()}
                  {r.repeat_count > 0 && (
                    <span className="badge ml-2" style={{ background: "#fce7f3", color: "#9d174d" }}>
                      リピーター
                    </span>
                  )}
                </div>
                {r.note && <div className="mt-1 text-xs text-black/40 whitespace-pre-wrap">備考：{r.note}</div>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`/admin/reservations/${r.id}`}
                    className="text-xs rounded-full border border-black/20 px-4 py-1.5 hover:bg-black/5"
                  >
                    詳細を見る
                  </a>
                  {r.status !== "confirmed" && r.status !== "cancelled" && (
                    <button
                      onClick={() => updateStatus(r.id, "confirmed")}
                      className="text-xs rounded-full bg-emerald-600 text-white px-4 py-1.5 hover:opacity-90"
                    >
                      確定する
                    </button>
                  )}
                  {/* 返金の扱い（お客様都合／当店都合）を選ぶため、キャンセルは詳細ページで行う */}
                  {r.status !== "cancelled" && (
                    <a
                      href={`/admin/reservations/${r.id}`}
                      className="text-xs rounded-full border border-red-300 text-red-600 px-4 py-1.5 hover:bg-red-50"
                    >
                      キャンセル（詳細へ）
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
