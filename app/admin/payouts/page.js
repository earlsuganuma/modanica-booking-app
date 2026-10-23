"use client";

import { useEffect, useState } from "react";
import AdminNav from "../../../components/AdminNav";

const yen = (n) => `¥${Number(n || 0).toLocaleString()}`;
const WD = ["日", "月", "火", "水", "木", "金", "土"];

function dateLabel(s) {
  const [y, m, d] = s.split("-").map(Number);
  return `${y}年${m}月${d}日（${WD[new Date(y, m - 1, d).getDay()]}）`;
}

export default function AdminPayoutsPage() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ cardFeeRate: "", paypayFeeRate: "", transferFee: "" });
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/payouts", { cache: "no-store" });
    const d = await res.json();
    setData(d);
    setForm({
      cardFeeRate: String(d.settings.cardFeeRate),
      paypayFeeRate: String(d.settings.paypayFeeRate),
      transferFee: String(d.settings.transferFee),
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e) {
    e.preventDefault();
    setMsg("");
    setSaving(true);
    const res = await fetch("/api/admin/payouts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardFeeRate: Number(form.cardFeeRate),
        paypayFeeRate: Number(form.paypayFeeRate),
        transferFee: Number(form.transferFee),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMsg(d.message || "保存に失敗しました。");
      return;
    }
    setMsg("保存しました。");
    load();
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const upcoming = (data?.payouts || []).filter((p) => p.date >= todayStr);
  const past = (data?.payouts || []).filter((p) => p.date < todayStr).slice(-4).reverse();

  return (
    <div className="space-y-6">
      <AdminNav />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">入金予定（概算）</h1>
        <button onClick={load} className="text-xs underline text-black/40">再読み込み</button>
      </div>

      <p className="text-xs text-black/50 leading-relaxed">
        PAY.JPの入金サイクル「月2回」（1〜15日の決済確定分は月末、16日〜月末の確定分は翌月15日に振込。土日祝は前営業日）で計算した目安です。
        決済手数料は「決済額×手数料率」で見積もり、返金があっても手数料は戻らない前提です。実際の入金額は、必ずPAY.JPの管理画面で確認してください。
      </p>

      {!data ? (
        <p className="text-sm text-black/40">読み込み中…</p>
      ) : (
        <>
          <div className="space-y-3">
            <h2 className="font-bold text-sm">これからの入金予定</h2>
            {upcoming.length === 0 && <p className="text-sm text-black/40">入金予定はありません。</p>}
            {upcoming.map((p) => (
              <div key={p.date} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-bold">{dateLabel(p.date)}</div>
                  <div className="text-lg font-bold">{p.net > 0 ? yen(p.net) : "繰越"}</div>
                </div>
                <div className="mt-2 text-xs text-black/50 space-y-0.5">
                  <div>売上 {yen(p.gross)}（{p.count}件）{p.refunded > 0 && <span> − 返金 {yen(p.refunded)}</span>}</div>
                  <div>− 決済手数料（概算）{yen(p.fee)}</div>
                  {p.carriedIn > 0 && <div>＋ 前回からの繰越 {yen(p.carriedIn)}</div>}
                  {p.transferFee > 0 && <div>− 振込手数料 {yen(p.transferFee)}</div>}
                  {p.carriedOut !== 0 && p.net === 0 && (
                    <div className="text-amber-700">振込対象額が1万円未満のため、次回へ繰り越します（{yen(p.carriedOut)}）。</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm text-sm">
            <div className="font-bold">決済待ち（カード与信中）</div>
            <div className="mt-1 text-black/60">
              {data.pendingAuth.count}件 / {yen(data.pendingAuth.amount)}
              <span className="text-xs text-black/40">　※予約を「確定」にすると売上になり、上の入金予定に入ります。</span>
            </div>
          </div>

          {past.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-bold text-sm text-black/60">直近の過去分（参考）</h2>
              {past.map((p) => (
                <div key={p.date} className="rounded-xl bg-black/[0.03] px-4 py-2 text-xs text-black/60 flex justify-between">
                  <span>{dateLabel(p.date)}（{p.count}件）</span>
                  <span>{p.net > 0 ? yen(p.net) : "繰越"}</span>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={save} className="rounded-2xl bg-white p-4 shadow-sm space-y-3 text-sm">
            <div className="font-bold">計算に使う手数料の設定</div>
            <p className="text-xs text-black/50">
              ご契約の料率に合わせて変更してください。初期値は仮の値です（PAY.JPの管理画面・ご契約内容でご確認ください）。
            </p>
            <div className="flex flex-wrap gap-4">
              <label className="block">
                <span className="text-xs text-black/50">カード決済手数料率（%）</span>
                <input type="number" step="0.01" min="0" max="20" required value={form.cardFeeRate}
                  onChange={(e) => setForm({ ...form, cardFeeRate: e.target.value })}
                  className="mt-1 block w-32 rounded-lg border border-black/15 px-3 py-2" />
              </label>
              <label className="block">
                <span className="text-xs text-black/50">PayPay決済手数料率（%）</span>
                <input type="number" step="0.01" min="0" max="20" required value={form.paypayFeeRate}
                  onChange={(e) => setForm({ ...form, paypayFeeRate: e.target.value })}
                  className="mt-1 block w-32 rounded-lg border border-black/15 px-3 py-2" />
              </label>
              <label className="block">
                <span className="text-xs text-black/50">振込手数料（円／回）</span>
                <input type="number" step="1" min="0" max="5000" required value={form.transferFee}
                  onChange={(e) => setForm({ ...form, transferFee: e.target.value })}
                  className="mt-1 block w-32 rounded-lg border border-black/15 px-3 py-2" />
              </label>
            </div>
            {msg && <p className="text-xs text-black/60">{msg}</p>}
            <button type="submit" disabled={saving} className="text-xs rounded-full bg-ink text-white px-5 py-2 hover:opacity-90 disabled:opacity-50">
              {saving ? "保存中…" : "保存する"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
