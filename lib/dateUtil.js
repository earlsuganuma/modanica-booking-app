// 日付文字列（YYYY-MM-DD）のためのユーティリティ。
// toISOString() はUTC変換されJSTでは日付がずれるため使わない（ローカル日時のまま計算する）。

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function daysBetween(fromStr, toStr) {
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T00:00:00`);
  return Math.round((to - from) / 86400000);
}

module.exports = { todayStr, daysBetween };
