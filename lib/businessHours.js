// カフェ・BBQエリアの営業時間（MVP簡易版：全曜日共通）。
const OPEN_TIME = "11:00";
const CLOSE_TIME = "22:00";
const OPEN_MINUTES = 11 * 60;
const CLOSE_MINUTES = 22 * 60;

function validateFlexibleTime(startTime, endTime) {
  if (!startTime || !endTime) return "利用時間を入力してください。";
  if (startTime < OPEN_TIME || endTime > CLOSE_TIME) {
    return `営業時間（${OPEN_TIME}〜${CLOSE_TIME}）内でご指定ください。`;
  }
  if (startTime >= endTime) {
    return "終了時刻は開始時刻より後にしてください。";
  }
  return null;
}

module.exports = { OPEN_TIME, CLOSE_TIME, OPEN_MINUTES, CLOSE_MINUTES, validateFlexibleTime };
