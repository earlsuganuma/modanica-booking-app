// オンライン予約の受付期間：サービス提供日（利用日）の90日前から。
// 特定商取引法に基づく表記（app/legal/tokushoho）・PAY.JPの本番利用申請の記載と一致させること。
const { todayStr, daysBetween } = require("./dateUtil");

const BOOKING_OPEN_DAYS_BEFORE = 90;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

// 予約できる最も先の日付（YYYY-MM-DD）
function maxBookableDate() {
  return addDays(todayStr(), BOOKING_OPEN_DAYS_BEFORE);
}

// お客様向けの予約で、利用日が受付期間内か確認する。問題があれば案内文、なければ null。
function validateBookingDate(date) {
  if (!date) return null;
  const days = daysBetween(todayStr(), date);
  if (days < 0) return "過去の日付は選択できません。";
  if (days > BOOKING_OPEN_DAYS_BEFORE) {
    return "オンライン予約は、ご利用日の90日前から受け付けております。恐れ入りますが、改めて日程が近づきましたらご予約ください。";
  }
  return null;
}

module.exports = { BOOKING_OPEN_DAYS_BEFORE, maxBookableDate, validateBookingDate, addDays };
