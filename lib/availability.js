const { load } = require("./store");
const { listBlocks } = require("./privateBlocks");

/**
 * 予約の重複判定。
 * ルール：資源(resource)が重なり、日時が重複するとき、
 * どちらか一方でも exclusivity !== 'partial' なら競合とみなす。
 * （partial 同士＝カフェの部分利用同士は共存を許可）
 *
 * さらに、競合の性質を区別する：
 * - 申込プランが非partial（宿泊・施設貸切など優先度の高いプラン）で、
 *   競合している既存予約がすべてpartial（カフェ利用等）の場合 → adjustable（要調整・交渉の余地あり）
 * - それ以外の競合 → hard（確定済みの排他予約同士の衝突。調整不可）
 */
async function hasConflict({ resourceIds, startDatetime, endDatetime, exclusivity, excludeReservationId, planId }) {
  const data = await load();
  const conflicts = [];

  for (const r of data.reservations) {
    if (r.status === "cancelled") continue;
    if (excludeReservationId && r.id === excludeReservationId) continue;

    const sharesResource = r.resourceIds.some((id) => resourceIds.includes(id));
    if (!sharesResource) continue;

    const overlaps = startDatetime < r.endDatetime && endDatetime > r.startDatetime;
    if (!overlaps) continue;

    const plan = data.plans.find((p) => p.id === r.planId);
    const existingExclusivity = plan ? plan.exclusivity : "partial";

    const bothPartial = exclusivity === "partial" && existingExclusivity === "partial";
    if (!bothPartial) {
      conflicts.push({ reservation: r, existingExclusivity });
    }
  }

  // 私用・予約不可の日時。対象プランを指定した枠は、そのプランだけが対象（指定なし＝全プラン）。調整の余地はない（hard）。
  for (const b of await listBlocks()) {
    const appliesToPlan = !b.planIds.length || (planId && b.planIds.includes(planId));
    if (appliesToPlan &&
      startDatetime < b.endDatetime && endDatetime > b.startDatetime) {
      conflicts.push({
        reservation: { id: null, startDatetime: b.startDatetime, endDatetime: b.endDatetime, privateBlock: true },
        existingExclusivity: "exclusive",
      });
    }
  }

  if (conflicts.length === 0) return { conflict: false, conflicts: [] };

  const adjustable = exclusivity !== "partial" && conflicts.every((c) => c.existingExclusivity === "partial");

  return { conflict: true, conflicts, adjustable, with: conflicts[0].reservation };
}

module.exports = { hasConflict };
