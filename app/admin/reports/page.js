"use client";

import { useEffect, useState } from "react";
import AdminNav from "../../../components/AdminNav";

function pad2(n) {
  return String(n).padStart(2, "0");
}

export default function AdminReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load(y, m) {
    setLoading(true);
    const res = await fetch(`/api/admin/reports/revenue?year=${y}&month=${m}`, { cache: "no-store" });
    const data = await res.json();
    setReport(data);
    setLoading(false);
  }

  useEffect(() => {
    load(year, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

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

  return (
    <div className="space-y-6">
      <AdminNav />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">売上レポート</h1>
        <button onClick={() => load(year, month)} className="text-xs underline text-black/40">再読み込み</button>
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

      {loading || !report ? (
        <p className="text-sm text-black/40">読み込み中…</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="text-xs text-black/40">確定売上</div>
              <div className="text-2xl font-bold mt-1">¥{report.totals.confirmed.toLocaleString()}</div>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="text-xs text-black/40">見込み売上（要確認）</div>
              <div className="text-2xl font-bold mt-1 text-amber-700">¥{report.totals.pending_review.toLocaleString()}</div>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="text-xs text-black/40">予約件数（キャンセル除く）</div>
              <div className="text-2xl font-bold mt-1">{report.reservationCount}件</div>
            </div>
          </div>

          <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-black/5 font-bold text-sm">プラン別内訳</div>
            <table className="w-full text-sm">
              <thead className="bg-black/5 text-black/50">
                <tr>
                  <th className="text-left px-4 py-2">プラン</th>
                  <th className="text-right px-4 py-2">件数</th>
                  <th className="text-right px-4 py-2">確定売上</th>
                  <th className="text-right px-4 py-2">見込み売上</th>
                </tr>
              </thead>
              <tbody>
                {report.byPlan.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-black/40">この月の予約はありません。</td>
                  </tr>
                ) : (
                  report.byPlan.map((p) => (
                    <tr key={p.planId} className="border-t border-black/5">
                      <td className="px-4 py-2">{p.planName}</td>
                      <td className="px-4 py-2 text-right">{p.count}</td>
                      <td className="px-4 py-2 text-right">¥{p.confirmed.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-amber-700">¥{p.pending_review.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-black/5 font-bold text-sm">日別内訳</div>
            <table className="w-full text-sm">
              <thead className="bg-black/5 text-black/50">
                <tr>
                  <th className="text-left px-4 py-2">日付</th>
                  <th className="text-right px-4 py-2">件数</th>
                  <th className="text-right px-4 py-2">確定売上</th>
                  <th className="text-right px-4 py-2">見込み売上</th>
                </tr>
              </thead>
              <tbody>
                {report.byDay.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-black/40">この月の予約はありません。</td>
                  </tr>
                ) : (
                  report.byDay.map((d) => (
                    <tr key={d.date} className="border-t border-black/5">
                      <td className="px-4 py-2">
                        {d.date}
                        <span className="text-black/30 ml-1">({"日月火水木金土"[new Date(`${d.date}T00:00:00`).getDay()]})</span>
                      </td>
                      <td className="px-4 py-2 text-right">{d.count}</td>
                      <td className="px-4 py-2 text-right">¥{d.confirmed.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-amber-700">¥{d.pending_review.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
