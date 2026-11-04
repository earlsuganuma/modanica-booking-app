// OTA（Booking.com・Airbnb）から iCal で取り込んだ「OTAブロック」（ota_blocks テーブル）。
// 1件＝ある部屋の連続した泊（チェックイン日〜チェックアウト日、終了日は含まない）。
// lib/availability.js が参照し、その部屋を使うプラン（部屋のみ・貸切）をすべて売り止めにする。
const { query } = require("./db");
const { NIGHT_START, NIGHT_END } = require("./ical");

// iCal 連携の対象部屋。slug は書き出し URL のファイル名（/ical/{token}/{slug}.ics）。
const ROOMS = [
  { slug: "naka", resourceId: "room_a", label: "中部屋" },
  { slug: "washitsu", resourceId: "room_b", label: "小部屋（和室）" },
];

// 連携チャネル。書き出し URL はチャネルごとに別トークン（同じチャネルから取り込んだ分は、そのチャネル向けに出さない）。
const CHANNELS = [
  { id: "booking", label: "Booking.com" },
  { id: "airbnb", label: "Airbnb" },
];

function roomBySlug(slug) {
  return ROOMS.find((r) => r.slug === slug) || null;
}
function roomByResource(resourceId) {
  return ROOMS.find((r) => r.resourceId === resourceId) || null;
}
function channelLabel(id) {
  return (CHANNELS.find((c) => c.id === id) || { label: id }).label;
}

function toOtaBlock(r) {
  return {
    id: r.id,
    feedId: r.feed_id,
    resourceId: r.resource_id,
    channel: r.channel,
    uid: r.uid,
    startDate: r.start_date,
    endDate: r.end_date,
    summary: r.summary || "",
    // 手入力（または今後のメール取り込み）で補う詳細。iCalには入っていない。
    guestName: r.guest_name || "",
    guestCount: r.guest_count ?? null,
    totalPrice: r.total_price ?? null,
    memo: r.memo || "",
    bookingRef: r.booking_ref || "",
    // 来店の記録：""（まだ来店していない）／ "visited"（来店済み）／ "no_show"（未来店）
    visitStatus: r.visit_status || "",
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
    // 重複判定用の時間帯（チェックイン日 16:00 〜 チェックアウト日 11:00）
    startDatetime: `${r.start_date}T${NIGHT_START}`,
    endDatetime: `${r.end_date}T${NIGHT_END}`,
  };
}

// テーブル未作成（移行SQLの実行前）でも予約処理が止まらないよう、エラー時は空配列を返す。
async function listOtaBlocks({ fromDate, client } = {}) {
  const q = client ? (t, p) => client.query(t, p) : query;
  try {
    const res = fromDate
      ? await q("SELECT * FROM ota_blocks WHERE end_date > $1 ORDER BY start_date, id", [fromDate])
      : await q("SELECT * FROM ota_blocks ORDER BY start_date, id");
    return res.rows.map(toOtaBlock);
  } catch (e) {
    if (e && e.code !== "42P01") console.error("listOtaBlocks failed:", e.message);
    return [];
  }
}

// OTA予約の詳細（お客様名・人数・金額・メモ）を保存する。日付や summary は触らない。
async function updateOtaBlockDetails(id, { guestName, guestCount, totalPrice, memo }) {
  const num = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.floor(Number(v))));
  const res = await query(
    `UPDATE ota_blocks SET guest_name = $2, guest_count = $3, total_price = $4, memo = $5, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, String(guestName || "").slice(0, 100), num(guestCount), num(totalPrice), String(memo || "").slice(0, 2000)]
  );
  return res.rows[0] ? toOtaBlock(res.rows[0]) : null;
}

// OTA予約の来店記録を保存する（"" / "visited" / "no_show"）。日程や詳細には触らない。
async function setOtaVisitStatus(id, status) {
  const v = status === "visited" || status === "no_show" ? status : "";
  const res = await query("UPDATE ota_blocks SET visit_status = $2, updated_at = now() WHERE id = $1 RETURNING *", [id, v]);
  return res.rows[0] ? toOtaBlock(res.rows[0]) : null;
}

module.exports = {
  ROOMS,
  CHANNELS,
  roomBySlug,
  roomByResource,
  channelLabel,
  listOtaBlocks,
  toOtaBlock,
  updateOtaBlockDetails,
  setOtaVisitStatus,
};
