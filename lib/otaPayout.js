// OTA（Booking.com）経由の入金予定の概算。実際の入金は、Booking.comの「ファイナンス」で確認すること（これは目安）。
//
// 前提（Booking.comの設定「週ごと・毎週木曜日に支払いを受け取る」）:
//   振込日 ＝ チェックアウト日の後の、最初の木曜日（例：11/6(金)チェックアウト → 11/12(木)）。実際の予約画面の表示に合わせた置き方。
//   振込額 ＝ 入力した宿泊料金（宿泊税は、現地で別に集めるため含めない）。
//   手数料（コミッション＆手数料）は、率で見積もる。振込から引かれるか、別請求かは、設定で切り替える（まだ未確認のため）。
// 対象：Booking.com の予約で、金額を入力済みのもの。Airbnb は、支払いの仕組みが違うため、今回は対象外。

const DEFAULT_COMMISSION_RATE = 14.3; // %（実際の予約: ¥13,027 に対して手数料 ¥1,863 ＝ 約14.3%）

function pad2(n) {
  return String(n).padStart(2, "0");
}

// チェックアウト日（YYYY-MM-DD）の後の、最初の木曜日
function nextThursdayAfter(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  do {
    dt.setUTCDate(dt.getUTCDate() + 1);
  } while (dt.getUTCDay() !== 4);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function buildOtaPayouts(blocks, settings = {}) {
  const rate = Number.isFinite(Number(settings.otaCommissionRate)) ? Number(settings.otaCommissionRate) : DEFAULT_COMMISSION_RATE;
  const deduct = Number(settings.otaDeduct) === 1;
  const groups = {};
  let unpriced = 0;
  for (const b of blocks || []) {
    if (b.channel !== "booking") continue;
    if (b.totalPrice == null) {
      unpriced += 1;
      continue;
    }
    const date = nextThursdayAfter(b.endDate);
    if (!groups[date]) groups[date] = { date, count: 0, gross: 0, commission: 0, items: [] };
    const g = groups[date];
    const commission = Math.floor((Number(b.totalPrice) * rate) / 100);
    g.count += 1;
    g.gross += Number(b.totalPrice);
    g.commission += commission;
    g.items.push({ name: b.guestName || "（お客様名未入力）", checkIn: b.startDate, checkOut: b.endDate, amount: Number(b.totalPrice), ref: b.bookingRef || "" });
  }
  const payouts = Object.values(groups)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((g) => ({ ...g, payout: deduct ? g.gross - g.commission : g.gross, net: g.gross - g.commission }));
  return { payouts, unpriced, commissionRate: rate, deduct };
}

module.exports = { DEFAULT_COMMISSION_RATE, nextThursdayAfter, buildOtaPayouts };
