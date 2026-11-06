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
  const [form, setForm] = useState({ cardFeeRate: "", paypayFeeRate: "", transferFee: "", otaCommissionRate: "", otaDeduct: "0" });
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
      otaCommissionRate: String(d.settings.otaCommissionRate ?? 14.3),
      otaDeduct: String(d.settings.otaDeduct ?? 0),
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
        otaCommissionRate: Number(form.otaCommissionRate),
        otaDeduct: Number(form.otaDeduct),
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
  const otaUpcoming = (data?.ota?.payouts || []).filter((p) => p.date >= todayStr);
  const otaPast = (data?.ota?.payouts || []).filter((p) => p.date < todayStr).slice(-4).reverse();
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
        決済手数料は「（決済額−返金額）×手数料率」で見積もります（返金分の手数料はPAY.JPが取り消すため）。返金は、元の売上と同じ振込分から引いて計算するため、実際の差し引きのタイミングとは異なる場合があります。実際の入金額は、必ずPAY.JPの管理画面で確認してください。
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

          <div className="space-y-3">
            <h2 className="font-bold text-sm">Booking.comの入金予定（概算）</h2>
            <p className="text-xs text-black/50 leading-relaxed">
              「毎週木曜日にお支払い」の設定から、チェックアウト日の後の最初の木曜日で計算した目安です。金額は、予約一覧に入力した宿泊料金（宿泊税は含みません）です。
              手数料は、料率で見積もります（振込から引かれるか、別請求かは、下の設定で切り替えます）。実際の入金は、Booking.comの「ファイナンス」で確認してください。
            </p>
            {data.ota && data.ota.unpriced > 0 && (
              <p className="rounded-xl bg-amber-50 text-amber-800 text-xs px-4 py-2">
                金額が未入力のBooking.com予約が{data.ota.unpriced}件あります（入金予定に含まれていません）。
              </p>
            )}
            {otaUpcoming.length === 0 && <p className="text-sm text-black/40">Booking.comの入金予定はありません。</p>}
            {otaUpcoming.map((p) => (
              <div key={p.date} className="rounded-2xl bg-white p-4 shadow-sm border-l-4 border-amber-400">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-bold">{dateLabel(p.date)}</div>
                  <div className="text-lg font-bold">{yen(p.payout)}</div>
                </div>
                <div className="mt-2 text-xs text-black/50 space-y-0.5">
                  <div>宿泊料金の合計 {yen(p.gross)}（{p.count}件）</div>
                  <div>
                    手数料（概算 {data.ota.commissionRate}%）{yen(p.commission)}
                    {data.ota.deduct ? "：振込から引く設定" : "：別請求の設定（振込額には影響しません）"}
                  </div>
                  <div>手数料を引いた手取りの目安 {yen(p.net)}</div>
                  <div className="pt-1 text-black/40">
                    {p.items.map((it) => (
                      <div key={`${it.ref}-${it.checkIn}-${it.name}`}>
                        ・{it.name}（{it.checkIn}〜{it.checkOut}） {yen(it.amount)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {otaPast.length > 0 && (
              <div className="space-y-2">
                {otaPast.map((p) => (
                  <div key={p.date} className="rounded-xl bg-black/[0.03] px-4 py-2 text-xs text-black/60 flex justify-between">
                    <span>{dateLabel(p.date)}（{p.count}件・Booking.com）</span>
                    <span>{yen(p.payout)}</span>
                  </div>
                ))}
              </div>
            )}
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
              <label className="block">
                <span className="text-xs text-black/50">Booking.comの手数料率（%）</span>
                <input type="number" step="0.01" min="0" max="40" required value={form.otaCommissionRate}
                  onChange={(e) => setForm({ ...form, otaCommissionRate: e.target.value })}
                  className="mt-1 block w-32 rounded-lg border border-black/15 px-3 py-2" />
              </label>
              <label className="block">
                <span className="text-xs text-black/50">Booking.comの手数料</span>
                <select value={form.otaDeduct} onChange={(e) => setForm({ ...form, otaDeduct: e.target.value })}
                  className="mt-1 block rounded-lg border border-black/15 px-3 py-2">
                  <option value="0">別請求（振込は手数料を引く前の額）</option>
                  <option value="1">振込から引かれる</option>
                </select>
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
