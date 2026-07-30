// 利用規約に定めたキャンセルポリシー（第4条）の金額計算。
// 「ご利用日の8日前まで無料／7〜3日前30%／2日前〜前日50%／当日100%」を
// startDatetime（"YYYY-MM-DDTHH:MM"形式の壁時計時刻）と実行日から機械的に算出する。

const { todayStr, daysBetween } = require("./dateUtil");

// 何日前かに応じたキャンセル料率（0〜1）を返す。
function cancellationFeeRate(startDatetime, now = todayStr()) {
  const useDate = (startDatetime || "").slice(0, 10);
  if (!useDate) return 0;
  const daysUntil = daysBetween(now, useDate);
  if (daysUntil >= 8) return 0;
  if (daysUntil >= 3) return 0.3;
  if (daysUntil >= 1) return 0.5;
  return 1; // 当日（0日）、または利用日を過ぎている場合も満額
}

// 実際にキャンセル料として差し引く金額（円）。totalPriceに料率を掛けて円未満切り捨て。
function cancellationFeeAmount(totalPrice, startDatetime, now = todayStr()) {
  const rate = cancellationFeeRate(startDatetime, now);
  return Math.floor((totalPrice || 0) * rate);
}

// 返金額（totalPrice - キャンセル料）。
function refundAmount(totalPrice, startDatetime, now = todayStr()) {
  return (totalPrice || 0) - cancellationFeeAmount(totalPrice, startDatetime, now);
}

module.exports = { cancellationFeeRate, cancellationFeeAmount, refundAmount };
