// リピーター判定（ゆるい判定）：電話番号が一致する、過去の（より前に受け付けた）有効な予約があるか。
// 全角数字・ハイフン・スペースなどの表記ゆれは無視して、数字だけで比較する。
// キャンセル済みの予約は回数に数えない。

function normalizeTel(tel) {
  const digits = String(tel || "")
    .normalize("NFKC")
    .replace(/[^0-9]/g, "");
  // 桁数が少なすぎる入力（空や短い番号）は一致判定に使わない
  return digits.length >= 9 ? digits : null;
}

/**
 * 予約ごとに「同じ電話番号の過去の有効な予約の件数」を返す関数を作る。
 */
function buildRepeatCounter(reservations) {
  const byTel = new Map();
  for (const r of reservations) {
    if (r.status === "cancelled") continue;
    const key = normalizeTel(r.customerTel);
    if (!key) continue;
    if (!byTel.has(key)) byTel.set(key, []);
    byTel.get(key).push(r.id);
  }
  return function repeatCount(reservation) {
    const key = normalizeTel(reservation.customerTel);
    if (!key) return 0;
    const ids = byTel.get(key) || [];
    return ids.filter((id) => id < reservation.id).length;
  };
}

module.exports = { normalizeTel, buildRepeatCounter };
