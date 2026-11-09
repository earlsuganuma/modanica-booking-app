"use client";

import { useEffect, useState } from "react";
import AdminNav from "../../../components/AdminNav";

// Booking.com の施設ID（管理画面の施設名の横に表示されている番号）。予約詳細ページへのリンクに使う。
const BOOKING_HOTEL_ID = "17571035";

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

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  // 既定は「来店前」（要確認・確定・来店記録のないOTA予約）。来店済み・未来店・キャンセルは外す。
  const [filter, setFilter] = useState("upcoming");
  const [otaList, setOtaList] = useState([]);
  const [otaEdit, setOtaEdit] = useState(null); // 編集中のOTA予約（フォームの値）
  const [otaSaving, setOtaSaving] = useState(false);
  const [otaError, setOtaError] = useState("");
  const [regPending, setRegPending] = useState([]); // 紐づけ待ちの宿泊者名簿
  const [regView, setRegView] = useState(null); // 名簿を表示中のOTA予約

  async function load() {
    setLoading(true);
    const [res, ores, pres] = await Promise.all([
      fetch("/api/admin/reservations", { cache: "no-store" }),
      fetch("/api/admin/ota-reservations", { cache: "no-store" }).catch(() => null),
      fetch("/api/admin/guest-registry", { cache: "no-store" }).catch(() => null),
    ]);
    const data = await res.json();
    setReservations(data.reservations || []);
    try {
      const pdata = pres && pres.ok ? await pres.json() : null;
      setRegPending((pdata && pdata.pending) || []);
    } catch (e) {
      setRegPending([]);
    }
    try {
      const odata = ores && ores.ok ? await ores.json() : null;
      setOtaList((odata && odata.reservations) || []);
    } catch (e) {
      setOtaList([]);
    }
    setLoading(false);
  }

  async function saveOta(e) {
    e.preventDefault();
    setOtaError("");
    setOtaSaving(true);
    const res = await fetch("/api/admin/ota-reservations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(otaEdit),
    });
    const d = await res.json().catch(() => ({}));
    setOtaSaving(false);
    if (!res.ok) {
      setOtaError(d.message || "保存に失敗しました。");
      return;
    }
    setOtaEdit(null);
    load();
  }

  useEffect(() => {
    load();
  }, []);

  // 紐づけ待ちの名簿：OTA予約に紐づける／削除する
  async function regAction(id, payload) {
    const res = await fetch("/api/admin/guest-registry", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...payload }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.message || "処理に失敗しました。");
    }
    load();
  }

  // OTA予約の来店記録：visited（来店済み）／ no_show（未来店）／ ""（元に戻す）
  async function setOtaVisit(id, visitStatus) {
    const res = await fetch("/api/admin/ota-reservations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "visit_status", visitStatus }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.message || "処理に失敗しました。");
    }
    load();
  }

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

  // 自社の予約と、OTA（iCal取り込み）の予約を、登録・取り込みの新しい順に混ぜて表示する。
  // OTAの行は読み取り専用（確定・キャンセルなどの操作はなく、メモなどの詳細だけ編集できる）。
  const otaVisible = (o) => {
    const v = o.visit_status || "";
    if (filter === "all" || filter === "ota") return true;
    if (filter === "upcoming") return v === "";
    if (filter === "visited") return v === "visited";
    if (filter === "no_show") return v === "no_show";
    return false; // 要確認・確定・キャンセルは自社予約の状態なので、OTA予約は出さない
  };
  const resVisible = (r) => {
    if (filter === "all") return true;
    if (filter === "upcoming") return r.status === "pending_review" || r.status === "confirmed";
    return r.status === filter;
  };
  const items = [
    ...otaList.filter(otaVisible).map((o) => ({ kind: "ota", key: `ota${o.id}`, sort: o.created_at || "", o })),
    ...(filter === "ota"
      ? []
      : reservations.filter(resVisible).map((r) => ({ kind: "res", key: `r${r.id}`, sort: r.created_at || "", r }))),
  ].sort((a, b) => String(b.sort).localeCompare(String(a.sort)));
  const filtered = items;

  return (
    <div className="space-y-6">
      <AdminNav />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">予約一覧</h1>
        <div className="flex items-center gap-3">
          <a
            href="/admin/reservations/new"
            className="text-xs rounded-full bg-ink text-white px-3 py-1.5 hover:opacity-90"
          >
            ＋ 予約を登録（電話・店頭）
          </a>
          <a
            href="/api/admin/reservations/lodger-csv"
            className="text-xs rounded-full border border-black/20 px-3 py-1.5 hover:bg-black/5"
          >
            宿泊者名簿をCSV出力
          </a>
          <a
            href="/admin/checkin-qr"
            className="text-xs rounded-full border border-black/20 px-3 py-1.5 hover:bg-black/5"
          >
            名簿フォームのQR・URL
          </a>
          <button onClick={load} className="text-xs underline text-black/40">再読み込み</button>
        </div>
      </div>

      {regPending.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-3">
          <div className="font-bold text-sm text-amber-900">紐づけ待ちの宿泊者名簿（{regPending.length}件）</div>
          <p className="text-xs text-amber-900/70">
            OTA予約を1件に絞れなかった名簿です。該当するOTA予約を選んでください（OTA予約が届いていない場合は、届くと自動で紐づきます）。
          </p>
          {regPending.map((p) => (
            <div key={p.id} className="rounded-xl bg-white p-3 text-sm space-y-2">
              <div>
                <span className="font-bold">{p.guest_name}</span>
                <span className="text-black/50">
                  {" "}
                  チェックイン {p.check_in}／{p.total_guests}名（男{p.guest_male}・女{p.guest_female}・子{p.guest_children}）／{p.tel}
                  {p.booking_ref ? `／予約番号 ${p.booking_ref}` : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {p.candidates.length === 0 && <span className="text-xs text-black/40">同じ日のOTA予約は、まだありません。</span>}
                {p.candidates.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => regAction(p.id, { blockId: c.id })}
                    className="text-xs rounded-full bg-sky-600 text-white px-3 py-1.5 hover:opacity-90"
                  >
                    {c.label} に紐づける
                  </button>
                ))}
                <button
                  onClick={() => {
                    if (confirm("この名簿を削除します。よろしいですか？")) regAction(p.id, { action: "delete" });
                  }}
                  className="text-xs rounded-full border border-red-300 text-red-600 px-3 py-1.5 hover:bg-red-50"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        {["upcoming", "all", "pending_review", "confirmed", "visited", "no_show", "cancelled", "ota"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 border ${
              filter === s ? "bg-ink text-white border-ink" : "border-black/20 text-black/50"
            }`}
          >
            {s === "upcoming" ? "来店前" : s === "all" ? "すべて" : s === "ota" ? "OTA予約" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-black/40">読み込み中…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-black/40">
          {filter === "upcoming" ? "来店前の予約はありません。（来店済み・キャンセルなどは、上の絞り込みで見られます）" : "予約はまだありません。"}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            if (item.kind === "ota") {
              const o = item.o;
              return (
                <div key={item.key} className="rounded-2xl bg-white p-4 shadow-sm" style={{ borderLeft: "5px solid #eab308" }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="badge" style={{ background: "#fef9c3", color: "#854d0e" }}>{o.channel_label}</span>{" "}
                      <span className="font-bold">{o.room_label}</span>{" "}
                      {(o.registry || []).length > 0 ? (
                        <span className="badge badge-confirmed">名簿入力済み</span>
                      ) : (
                        <span className="badge" style={{ background: "#f3f4f6", color: "#6b7280" }}>名簿未入力</span>
                      )}{" "}
                      {o.repeat_count > 0 && (
                        <span
                          className="badge"
                          style={{ background: "#fce7f3", color: "#9d174d" }}
                          title="名簿の電話番号が、過去の予約・名簿と一致しています"
                        >
                          リピーター（過去{o.repeat_count}回）
                        </span>
                      )}{" "}
                      {o.visit_status === "visited" && <span className={STATUS_BADGE.visited}>{STATUS_LABEL.visited}</span>}
                      {o.visit_status === "no_show" && <span className={STATUS_BADGE.no_show}>{STATUS_LABEL.no_show}</span>}{" "}
                      <span className="text-xs text-black/40">OTA予約（日程はOTA側で管理）</span>
                    </div>
                    <div className="text-sm text-black/50">
                      {o.start_date} IN 〜 {o.end_date} OUT（{o.nights}泊）
                    </div>
                  </div>
                  <div className="mt-2 grid sm:grid-cols-3 gap-2 text-sm text-black/60">
                    <div>
                      お客様：{o.guest_name || "（未入力）"}{o.guest_count != null ? `（${o.guest_count}名）` : ""}
                      {o.booking_ref ? <span className="text-xs text-black/40">　予約番号 {o.booking_ref}</span> : null}
                    </div>
                    <div>金額：{o.total_price != null ? `¥${Number(o.total_price).toLocaleString()}` : "（未入力）"}</div>
                    <div className="text-xs text-black/40 truncate">OTA表示：{o.summary || "-"}</div>
                  </div>
                  {o.memo && <div className="mt-1 text-xs text-black/40 whitespace-pre-wrap">メモ：{o.memo}</div>}
                  <div className="mt-3 flex flex-wrap gap-2 items-center">
                    {o.visit_status !== "visited" && (
                      <button
                        onClick={() => setOtaVisit(o.id, "visited")}
                        className="text-xs rounded-full bg-sky-600 text-white px-4 py-1.5 hover:opacity-90"
                      >
                        来店済みにする
                      </button>
                    )}
                    {o.visit_status !== "no_show" && (
                      <button
                        onClick={() => setOtaVisit(o.id, "no_show")}
                        className="text-xs rounded-full border border-black/20 px-4 py-1.5 hover:bg-black/5"
                      >
                        未来店にする
                      </button>
                    )}
                    {o.visit_status && (
                      <button
                        onClick={() => setOtaVisit(o.id, "")}
                        className="text-xs rounded-full border border-black/20 px-4 py-1.5 hover:bg-black/5"
                      >
                        来店前に戻す
                      </button>
                    )}
                    {(o.registry || []).length > 0 && (
                      <button
                        onClick={() => setRegView(o)}
                        className="text-xs rounded-full border border-emerald-300 text-emerald-700 px-4 py-1.5 hover:bg-emerald-50"
                      >
                        名簿を見る
                      </button>
                    )}
                    {o.channel === "booking" && o.booking_ref && (
                      <a
                        href={`https://admin.booking.com/hotel/hoteladmin/extranet_ng/manage/booking.html?res_id=${encodeURIComponent(o.booking_ref)}&hotel_id=${BOOKING_HOTEL_ID}&lang=ja`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs rounded-full border border-sky-300 text-sky-700 px-4 py-1.5 hover:bg-sky-50"
                      >
                        Booking.comで詳細を開く
                      </a>
                    )}
                    <button
                      onClick={() => {
                        setOtaError("");
                        setOtaEdit({
                          id: o.id,
                          title: `${o.channel_label} ${o.room_label} ${o.start_date}〜${o.end_date}`,
                          guestName: o.guest_name || "",
                          bookingRef: o.booking_ref || "",
                          guestCount: o.guest_count ?? "",
                          totalPrice: o.total_price ?? "",
                          memo: o.memo || "",
                        });
                      }}
                      className="text-xs rounded-full border border-black/20 px-4 py-1.5 hover:bg-black/5"
                    >
                      詳細・メモを編集
                    </button>
                  </div>
                </div>
              );
            }
            const r = item.r;
            return (
            <div key={item.key} className="rounded-2xl bg-white p-4 shadow-sm">
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
                  {r.room_stay_overlaps && r.room_stay_overlaps.length > 0 && (
                    <span
                      className="badge"
                      style={{ background: "#fee2e2", color: "#991b1b" }}
                      title={r.room_stay_overlaps.join("\n")}
                    >
                      要調整：同じ夜に小部屋の宿泊あり
                    </span>
                  )}
                </div>
                <div className="text-sm text-black/50">
                  {r.start_datetime.replace("T", " ")} 〜 {r.end_datetime.replace("T", " ")}
                </div>
              </div>
              <div className="mt-2 grid sm:grid-cols-3 gap-2 text-sm text-black/60">
                <div>
                  お客様：{r.customer_name}（{r.guest_count}名
                  {r.guest_male != null ? `：男${r.guest_male}・女${r.guest_female}・子${r.guest_children}` : ""}
                  ）
                  {r.repeat_count > 0 && (
                    <span
                      className="badge ml-1"
                      style={{ background: "#fce7f3", color: "#9d174d" }}
                      title="同じ電話番号の過去の予約があります"
                    >
                      リピーター（過去{r.repeat_count}回）
                    </span>
                  )}
                </div>
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
                        {r.status === "visited" || r.status === "no_show" ? "確定に戻す" : "確定する"}
                      </button>
                    )}
                    {(r.status === "confirmed" || r.status === "no_show") && (
                      <button
                        onClick={() => updateStatus(r.id, "visited")}
                        className="text-xs rounded-full bg-sky-600 text-white px-4 py-1.5 hover:opacity-90"
                      >
                        来店済みにする
                      </button>
                    )}
                    {(r.status === "confirmed" || r.status === "visited") && (
                      <button
                        onClick={() => updateStatus(r.id, "no_show")}
                        className="text-xs rounded-full border border-black/20 px-4 py-1.5 hover:bg-black/5"
                      >
                        未来店にする
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
                    {/* 返金の扱い（お客様都合／当店都合）を選ぶため、キャンセルは詳細ページで行う */}
                    <a
                      href={`/admin/reservations/${r.id}`}
                      className="text-xs rounded-full border border-red-300 text-red-600 px-4 py-1.5 hover:bg-red-50"
                    >
                      キャンセル（詳細へ）
                    </a>
                  </>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {regView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl space-y-4 text-sm">
            <div className="font-bold">宿泊者名簿</div>
            <div className="text-xs text-black/50">
              {regView.channel_label} {regView.room_label} {regView.start_date}〜{regView.end_date}
            </div>
            {regView.registry.map((e) => (
              <div key={e.id} className="rounded-xl border border-black/10 p-3 space-y-1">
                <div className="font-bold">{e.guest_name}</div>
                <div>ご住所：{e.address}</div>
                <div>電話：{e.tel}{e.email ? `／${e.email}` : ""}</div>
                <div>人数：男{e.guest_male}・女{e.guest_female}・子供{e.guest_children}（計{e.guest_male + e.guest_female + e.guest_children}名）</div>
                {e.arrival_time && <div>到着予定：{e.arrival_time}</div>}
                {e.nationality && e.nationality !== "日本" && (
                  <div>国籍：{e.nationality}／旅券番号：{e.passport_no}</div>
                )}
                {e.note && <div className="whitespace-pre-wrap text-black/60">備考：{e.note}</div>}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-black/40">入力日時：{new Date(e.created_at).toLocaleString("ja-JP")}</span>
                  <button
                    onClick={() => {
                      if (confirm("この名簿の紐づけを外します（名簿は「紐づけ待ち」に戻ります）。よろしいですか？")) {
                        setRegView(null);
                        regAction(e.id, { action: "unlink" });
                      }
                    }}
                    className="text-xs underline text-black/40"
                  >
                    紐づけを外す
                  </button>
                </div>
              </div>
            ))}
            <button onClick={() => setRegView(null)} className="text-xs rounded-full border border-black/20 px-5 py-2 hover:bg-black/5">
              閉じる
            </button>
          </div>
        </div>
      )}

      {otaEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={saveOta} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-3 text-sm">
            <div className="font-bold">OTA予約の詳細</div>
            <div className="text-xs text-black/50">{otaEdit.title}</div>
            <p className="text-xs text-black/40">
              OTAのカレンダーには日程と部屋しか入っていないため、お客様名などは手で入力します（任意）。入力すると、Googleカレンダーの予定にも反映されます。
            </p>
            <label className="block">
              <span className="text-xs text-black/50">お客様名</span>
              <input value={otaEdit.guestName} onChange={(e) => setOtaEdit({ ...otaEdit, guestName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" />
            </label>
            <label className="block">
              <span className="text-xs text-black/50">予約番号（OTA）</span>
              <input value={otaEdit.bookingRef || ""} onChange={(e) => setOtaEdit({ ...otaEdit, bookingRef: e.target.value })}
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" placeholder="例：5873912097" />
            </label>
            <div className="flex gap-3">
              <label className="block flex-1">
                <span className="text-xs text-black/50">人数</span>
                <input type="number" min="0" value={otaEdit.guestCount} onChange={(e) => setOtaEdit({ ...otaEdit, guestCount: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" />
              </label>
              <label className="block flex-1">
                <span className="text-xs text-black/50">金額（円）</span>
                <input type="number" min="0" value={otaEdit.totalPrice} onChange={(e) => setOtaEdit({ ...otaEdit, totalPrice: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" />
              </label>
            </div>
            <label className="block">
              <span className="text-xs text-black/50">メモ</span>
              <textarea rows={3} value={otaEdit.memo} onChange={(e) => setOtaEdit({ ...otaEdit, memo: e.target.value })}
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2" />
            </label>
            {otaError && <p className="text-xs text-red-600">{otaError}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={otaSaving} className="text-xs rounded-full bg-ink text-white px-5 py-2 hover:opacity-90 disabled:opacity-50">
                {otaSaving ? "保存中…" : "保存する"}
              </button>
              <button type="button" onClick={() => setOtaEdit(null)} className="text-xs rounded-full border border-black/20 px-5 py-2 hover:bg-black/5">
                閉じる
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
