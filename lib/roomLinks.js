// 「このプランの予約が入っている時間は、この部屋を宿泊で売らない」ルール。
//
// 例：飲み会貸切（p6）・BBQレンタルスペース貸切（p5）は、夜までかかる枠（17:00〜／終日）だと、
//     小部屋（和室）にお泊まりのお客様がいると、音や人の出入りが気になるため、小部屋の宿泊を売り止めにする。
//
// 仕組み：予約には、プランの部屋（resource_ids）が予約時に保存される。ここで決めたプランの予約は、
//   保存された部屋に加えて、下の部屋も「使っている」ものとして扱う（予約の保存内容は変えない）。
//   ・自社サイト・管理画面：その時間帯に、その部屋の宿泊（部屋のみ）が新しく取れなくなる（lib/availability.js）
//   ・OTA（Booking.com・Airbnb）：その泊が、売り止めとして書き出される（lib/icalSync.js）
//   ・すでに入っている予約は、そのまま有効（キャンセル・変更はしない）
// 昼のBBQ（11:00〜16:00）や、昼の飲み会は、宿泊の時間帯（16:00〜翌11:00）と重ならないため、自然に対象外になる。
// 変えたいときは、下の表のプランIDを足す・減らす。
const EXTRA_ROOMS_BY_PLAN = {
  p5: ["room_b"], // BBQレンタルスペース貸切
  p6: ["room_b"], // 飲み会貸切（8名以上）
};

function effectiveResourceIds(planId, resourceIds) {
  const extra = EXTRA_ROOMS_BY_PLAN[planId];
  const base = Array.isArray(resourceIds) ? resourceIds : [];
  if (!extra || !extra.length) return base;
  return [...new Set([...base, ...extra])];
}

// ある部屋について、追加で「使っている」扱いにするプランのID
function planIdsLinkedToRoom(resourceId) {
  return Object.keys(EXTRA_ROOMS_BY_PLAN).filter((id) => EXTRA_ROOMS_BY_PLAN[id].includes(resourceId));
}

// 逆向き：飲み会貸切・夜BBQの予約と、同じ時間帯に重なる、その部屋の宿泊（自社の部屋のみ予約・OTA）の一覧。
// 予約は受け付ける（要確認のまま）が、管理画面に「要調整」として表示するために使う。
// reservation: { planId, startDatetime, endDatetime, status }
// data: await load() の結果（reservations, plans）  otaBlocks: listOtaBlocks() の結果
function roomStayOverlaps(reservation, data, otaBlocks = []) {
  const rooms = EXTRA_ROOMS_BY_PLAN[reservation.planId];
  if (!rooms || !rooms.length) return [];
  if (reservation.status === "cancelled") return [];
  const out = [];
  const overlaps = (s, e) => reservation.startDatetime < e && reservation.endDatetime > s;
  for (const r of data.reservations || []) {
    if (r.id === reservation.id || r.status === "cancelled") continue;
    const plan = (data.plans || []).find((p) => p.id === r.planId);
    if (!plan || plan.exclusivity !== "room") continue; // 部屋のみ（宿泊）プランだけ
    if (!(r.resourceIds || []).some((id) => rooms.includes(id))) continue;
    if (overlaps(r.startDatetime, r.endDatetime)) {
      out.push(`予約番号 ${r.id}（${plan.name}）${r.startDatetime.slice(0, 10)}〜${r.endDatetime.slice(0, 10)}`);
    }
  }
  for (const b of otaBlocks) {
    if (!rooms.includes(b.resourceId)) continue;
    if (overlaps(b.startDatetime, b.endDatetime)) {
      out.push(`${b.channelLabel || b.channel}の予約${b.guestName ? `（${b.guestName}様）` : ""} ${b.startDate}〜${b.endDate}`);
    }
  }
  return out;
}

module.exports = { EXTRA_ROOMS_BY_PLAN, effectiveResourceIds, planIdsLinkedToRoom, roomStayOverlaps };
