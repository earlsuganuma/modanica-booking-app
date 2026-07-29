"use client";

import { useEffect, useState } from "react";

const OPEN_MIN = 11 * 60;
const CLOSE_MIN = 22 * 60;
const TOTAL_MIN = CLOSE_MIN - OPEN_MIN;
const HOUR_TICKS = [11, 13, 15, 17, 19, 21, 22];

function minutesSinceOpen(datetimeStr, date) {
  const [d, t] = datetimeStr.split("T");
  if (d < date) return 0;
  if (d > date) return TOTAL_MIN;
  const [hh, mm] = t.split(":").map(Number);
  const mins = hh * 60 + mm - OPEN_MIN;
  return Math.max(0, Math.min(TOTAL_MIN, mins));
}

export default function TimeAxis({ resourceIds, date }) {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date || !resourceIds || resourceIds.length === 0) {
      setSegments([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/schedule?resourceIds=${encodeURIComponent(resourceIds.join(","))}&date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSegments(data.segments || []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resourceIds?.join(","), date]);

  if (!date) return null;

  return (
    <div className="text-xs">
      <div className="flex items-center justify-between mb-1">
        <span className="text-black/50">当日の予約状況（11:00〜22:00）</span>
        {loading && <span className="text-black/30">読み込み中…</span>}
      </div>
      <div className="relative h-8 rounded-md bg-emerald-50 border border-black/10 overflow-hidden">
        {segments.map((seg, i) => {
          const left = (minutesSinceOpen(seg.start, date) / TOTAL_MIN) * 100;
          const right = (minutesSinceOpen(seg.end, date) / TOTAL_MIN) * 100;
          const width = Math.max(0, right - left);
          if (width <= 0) return null;
          return (
            <div
              key={i}
              title="予約済み"
              className="absolute top-0 bottom-0 bg-black/25 border-x border-white/60"
              style={{ left: `${left}%`, width: `${width}%` }}
            />
          );
        })}
      </div>
      <div className="relative h-4 mt-0.5 text-[10px] text-black/40">
        {HOUR_TICKS.map((h) => (
          <span
            key={h}
            className="absolute -translate-x-1/2"
            style={{ left: `${((h * 60 - OPEN_MIN) / TOTAL_MIN) * 100}%` }}
          >
            {h}時
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-3 text-black/40">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-emerald-50 border border-black/10" />空き
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-black/25" />予約済み
        </span>
      </div>
    </div>
  );
}
