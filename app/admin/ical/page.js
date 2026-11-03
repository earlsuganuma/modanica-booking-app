"use client";

import { useEffect, useState } from "react";
import AdminNav from "../../../components/AdminNav";

// OTA（Booking.com・Airbnb）との iCal 在庫同期の設定画面。
function fmtTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function nightsLabel(b) {
  const n = Math.round((Date.parse(b.endDate) - Date.parse(b.startDate)) / 86400000);
  return `${b.startDate} IN 〜 ${b.endDate} OUT（${n}泊）`;
}

const STATUS_LABEL = { ok: "正常", fetch_error: "取得失敗", parse_error: "解析失敗" };

export default function AdminIcalPage() {
  const [st, setSt] = useState(null);
  const [urls, setUrls] = useState({}); // { "room_a:booking": "https://..." }
  const [msg, setMsg] = useState({}); // { key: "saved" | エラー文 }
  const [busy, setBusy] = useState("");
  const [syncResult, setSyncResult] = useState(null);
  const [copied, setCopied] = useState("");

  function apply(data) {
    setSt(data);
    const u = {};
    for (const f of data.feeds || []) u[`${f.resourceId}:${f.channel}`] = f.importUrl;
    setUrls(u);
  }

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/ical", { cache: "no-store" });
      apply(await res.json());
    })();
  }, []);

  async function saveFeed(resourceId, channel) {
    const key = `${resourceId}:${channel}`;
    const importUrl = (urls[key] || "").trim();
    const had = (st.feeds || []).some((f) => f.resourceId === resourceId && f.channel === channel);
    if (!importUrl && had && !confirm("取り込みURLの登録を解除します。このURLから取り込んだ売り止めもすべて解除されます。よろしいですか？")) return;
    setBusy(key);
    const res = await fetch("/api/admin/ical", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId, channel, importUrl }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) {
      setMsg((m) => ({ ...m, [key]: data.message || "保存に失敗しました。" }));
      return;
    }
    apply(data);
    setMsg((m) => ({ ...m, [key]: "saved" }));
  }

  async function syncNow() {
    setBusy("sync");
    setSyncResult(null);
    const res = await fetch("/api/admin/ical", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) {
      setSyncResult({ error: data.message || "取得に失敗しました。" });
      return;
    }
    apply(data);
    setSyncResult(data.result);
  }

  async function regenerate(channel, label) {
    if (!confirm(`${label} 向けの書き出しURLを再発行します。今のURLは使えなくなるので、${label} 側の登録も新しいURLに差し替えてください。よろしいですか？`)) return;
    setBusy(`regen:${channel}`);
    const res = await fetch("/api/admin/ical", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "regenerate", channel }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (res.ok) apply(data);
  }

  async function copy(url) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(""), 1500);
    } catch (e) {
      window.prompt("コピーしてください", url);
    }
  }

  if (!st) {
    return (
      <div className="space-y-6">
        <AdminNav />
        <p className="text-sm text-black/40">読み込み中…</p>
      </div>
    );
  }

  const roomLabel = (id) => (st.rooms.find((r) => r.resourceId === id) || { label: id }).label;
  const chLabel = (id) => (st.channels.find((c) => c.id === id) || { label: id }).label;

  return (
    <div className="space-y-6">
      <AdminNav />
      <div>
        <h1 className="text-xl font-bold">OTA連携（iCal）</h1>
        <p className="text-sm text-black/50 mt-1">
          Booking.com・Airbnb と、中部屋・小部屋（和室）の空き状況をカレンダー（iCal）で同期します。在庫の正はこのシステムです。
          OTA側の予約は15分ごとに取り込み、その部屋と同じ日の貸切プラン（BBQ＋宿泊・飲み会＋宿泊・女子会）を自社サイトで売り止めにします。
        </p>
        {!st.tableReady && (
          <p className="mt-2 text-sm text-red-600">データベースの準備（scripts/add-ical-sync.sql の実行）が済んでいません。</p>
        )}
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
        <div>
          <h2 className="font-bold">1. 書き出しURL（OTA側に登録する）</h2>
          <p className="text-xs text-black/50 mt-1">
            各OTAの「カレンダーのインポート（同期）」に、部屋ごとのURLを登録してください。チャネルごとにURLが分かれています
            （そのチャネルから取り込んだ予約は、そのチャネル向けには出しません）。URLは推測できない文字列なので、外部に公開しないでください。
          </p>
        </div>
        {st.exportUrls.map((c) => (
          <div key={c.channel} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold">{c.label} 向け</h3>
              <button
                onClick={() => regenerate(c.channel, c.label)}
                disabled={busy === `regen:${c.channel}`}
                className="text-xs rounded-full border border-black/15 px-3 py-1 hover:bg-black/5 text-black/60 disabled:opacity-40"
              >
                URLを再発行
              </button>
            </div>
            {c.rooms.map((r) => (
              <div key={r.slug} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="w-full sm:w-28 shrink-0 text-black/60">{r.label}</span>
                <code className="flex-1 min-w-0 break-all font-mono text-[11px] rounded bg-black/5 px-2 py-1">{r.url}</code>
                <button onClick={() => copy(r.url)} className="rounded-full border border-black/15 px-3 py-1 hover:bg-black/5">
                  {copied === r.url ? "コピーしました" : "コピー"}
                </button>
              </div>
            ))}
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold">2. 取り込みURL（OTA側の書き出しURL）</h2>
            <p className="text-xs text-black/50 mt-1">
              OTAの管理画面にある「カレンダーのエクスポート」URL（.ics）を、部屋ごとに貼り付けて保存してください。空欄で保存すると登録解除です。
              取得・解析に失敗したときは、取り込み済みの売り止めをそのまま維持し、管理者にメールでお知らせします。
            </p>
          </div>
          <button
            onClick={syncNow}
            disabled={busy === "sync" || !(st.feeds || []).length}
            className="text-xs rounded-full bg-ink text-white px-4 py-1.5 hover:opacity-90 disabled:opacity-40"
          >
            {busy === "sync" ? "取得中…" : "今すぐ取得"}
          </button>
        </div>

        {syncResult && (
          <div className="rounded-lg bg-black/5 p-3 text-xs space-y-1">
            {syncResult.error ? (
              <div className="text-red-600">{syncResult.error}</div>
            ) : syncResult.skipped ? (
              <div>別の取得処理が実行中のため、今回はスキップしました。少し待ってから再度お試しください。</div>
            ) : (
              (syncResult.feeds || []).map((f) => (
                <div key={`${f.resourceId}:${f.channel}`}>
                  {chLabel(f.channel)}／{roomLabel(f.resourceId)}：
                  {f.ok ? `正常（${f.events}件・追加${f.added}・変更${f.changed}・解除${f.removed}）` : <span className="text-red-600">{f.error}</span>}
                </div>
              ))
            )}
          </div>
        )}

        {st.channels.map((c) => (
          <div key={c.id} className="space-y-3">
            <h3 className="text-sm font-bold">{c.label}</h3>
            {st.rooms.map((r) => {
              const key = `${r.resourceId}:${c.id}`;
              const feed = (st.feeds || []).find((f) => f.resourceId === r.resourceId && f.channel === c.id);
              return (
                <div key={key} className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="w-full sm:w-28 shrink-0 text-black/60">{r.label}</span>
                    <input
                      type="url"
                      value={urls[key] || ""}
                      onChange={(e) => {
                        setUrls((u) => ({ ...u, [key]: e.target.value }));
                        setMsg((m) => ({ ...m, [key]: undefined }));
                      }}
                      placeholder="https://… .ics"
                      className="flex-1 min-w-0 rounded-lg border border-black/15 px-3 py-1.5"
                    />
                    <button
                      onClick={() => saveFeed(r.resourceId, c.id)}
                      disabled={busy === key}
                      className="rounded-full bg-ink text-white px-4 py-1.5 hover:opacity-90 disabled:opacity-40"
                    >
                      保存
                    </button>
                  </div>
                  <div className="pl-0 sm:pl-[7.5rem] text-[11px] text-black/50">
                    {msg[key] === "saved" && <span className="text-emerald-600 mr-2">保存しました</span>}
                    {msg[key] && msg[key] !== "saved" && <span className="text-red-600 mr-2">{msg[key]}</span>}
                    {feed ? (
                      <>
                        最終取得 {fmtTime(feed.lastFetchedAt)}・
                        {feed.lastStatus ? (
                          <span className={feed.lastStatus === "ok" ? "text-emerald-700" : "text-red-600"}>
                            {STATUS_LABEL[feed.lastStatus] || feed.lastStatus}
                          </span>
                        ) : (
                          "未取得"
                        )}
                        {feed.lastStatus === "ok" && `（${feed.lastEventCount}件）`}
                        {feed.lastStatus && feed.lastStatus !== "ok" && feed.lastError && `：${feed.lastError}`}
                        {feed.failCount > 1 && `（${feed.failCount}回連続）`}
                      </>
                    ) : (
                      "未登録"
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
        <h2 className="font-bold">3. 取り込み中の売り止め（OTAブロック）</h2>
        {!st.blocks.length ? (
          <p className="text-sm text-black/40">現在、OTAから取り込んだ売り止めはありません。</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-xs">
            <thead>
              <tr className="text-left text-black/50">
                <th className="py-1 pr-2">日程</th>
                <th className="py-1 pr-2">部屋</th>
                <th className="py-1 pr-2">チャネル</th>
                <th className="py-1">OTA側の表示</th>
              </tr>
            </thead>
            <tbody>
              {st.blocks.map((b) => (
                <tr key={b.id} className="border-t border-black/5">
                  <td className="py-1.5 pr-2 whitespace-nowrap">{nightsLabel(b)}</td>
                  <td className="py-1.5 pr-2">{roomLabel(b.resourceId)}</td>
                  <td className="py-1.5 pr-2">{chLabel(b.channel)}</td>
                  <td className="py-1.5 text-black/50 break-all">{b.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        <p className="text-[11px] text-black/40">
          OTAブロックはOTA側の予約に連動するため、ここでは削除できません（OTA側でキャンセルされると自動で解除されます）。
        </p>
      </section>
    </div>
  );
}
