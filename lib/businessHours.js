// カフェ・BBQエリアの営業時間（MVP簡易版：全曜日共通）。
const OPEN_TIME = "11:00";
const CLOSE_TIME = "22:00";
const OPEN_MINUTES = 11 * 60;
const CLOSE_MINUTES = 22 * 60;

// 終了時刻はお客様には選択させず、プランごとの固定利用時間から自動算出する
// （lib/timeTemplates.js の computeFlexibleEndTime）。ここでは開始時刻のみ検証する。
function validateFlexibleStart(startTime) {
  if (!startTime) return "利用開始時刻を入力してください。";
  if (startTime < OPEN_TIME || startTime >= CLOSE_TIME) {
    return `営業時間（${OPEN_TIME}〜${CLOSE_TIME}）内でご指定ください。`;
  }
  return null;
}

module.exports = { OPEN_TIME, CLOSE_TIME, OPEN_MINUTES, CLOSE_MINUTES, validateFlexibleStart };
