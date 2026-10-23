// PAY.JPの入金予定の概算。実際の入金額はPAY.JPの管理画面で確認すること（これは目安）。
//
// 前提（PAY.JPの入金サイクル「月2回」）:
//   決済確定日が 1〜15日 → 当月末に振込 / 16日〜月末 → 翌月15日に振込（土日祝は前営業日）
//   振込額 = 売上 − 決済手数料 − 振込手数料（1回につき）。1万円未満は次回に繰り越し。
// 概算の置き方:
//   ・決済確定日は reservations.captured_at（なければ予約日時）。
//   ・決済手数料は「決済額 × 料率」。返金があっても手数料は戻らない前提（少なめに見積もる側）。
//   ・返金額は、元の売上と同じ振込分から差し引く（返金日は保存していないため）。
const { getSettings } = require("./appSettings");
const { computeJapanHolidays } = require("./holidays");

const DEFAULTS = { cardFeeRate: 3.6, paypayFeeRate: 3.6, transferFee: 250, minPayout: 10000 };
const KEYS = {
  cardFeeRate: "payout.card_fee_rate",
  paypayFeeRate: "payout.paypay_fee_rate",
  transferFee: "payout.transfer_fee",
};

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && v !== "" && v != null ? n : fallback;
}

async function loadPayoutSettings() {
  const s = await getSettings("payout.");
  return {
    cardFeeRate: num(s[KEYS.cardFeeRate], DEFAULTS.cardFeeRate),
    paypayFeeRate: num(s[KEYS.paypayFeeRate], DEFAULTS.paypayFeeRate),
    transferFee: num(s[KEYS.transferFee], DEFAULTS.transferFee),
    minPayout: DEFAULTS.minPayout,
  };
}

function pad2(n) {
  return String(n).padStart(2, "0");
}
function ymd(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}
function lastDayOfMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

const holidayCache = {};
function holidaySet(year) {
  if (!holidayCache[year]) holidayCache[year] = new Set(computeJapanHolidays(year).map((h) => h.date));
  return holidayCache[year];
}
function isBusinessDay(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return wd !== 0 && wd !== 6 && !holidaySet(y).has(dateStr);
}
function prevBusinessDay(dateStr) {
  let [y, m, d] = dateStr.split("-").map(Number);
  let cur = dateStr;
  let guard = 0;
  while (!isBusinessDay(cur) && guard < 15) {
    const dt = new Date(y, m - 1, d - 1);
    y = dt.getFullYear();
    m = dt.getMonth() + 1;
    d = dt.getDate();
    cur = ymd(y, m, d);
    guard += 1;
  }
  return cur;
}

// 決済確定日（YYYY-MM-DD）→ 振込日（YYYY-MM-DD）
function payoutDateFor(capturedDay) {
  const [y, m, d] = capturedDay.split("-").map(Number);
  if (d <= 15) return prevBusinessDay(ymd(y, m, lastDayOfMonth(y, m)));
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return prevBusinessDay(ymd(ny, nm, 15));
}

function jstDay(iso) {
  // captured_at / createdAt は ISO文字列。日本時間の日付にそろえる。
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return ymd(jst.getUTCFullYear(), jst.getUTCMonth() + 1, jst.getUTCDate());
}

function buildPayoutForecast(data, settings) {
  const feeRate = (r) => (r.cardBrand === "PayPay" ? settings.paypayFeeRate : settings.cardFeeRate) / 100;

  const groups = {};
  let pendingAuth = { count: 0, amount: 0 };
  for (const r of data.reservations || []) {
    if (r.status === "cancelled" && r.paymentStatus === "authorized") continue;
    if (r.paymentStatus === "authorized" && r.status !== "cancelled") {
      pendingAuth.count += 1;
      pendingAuth.amount += r.paymentAmount || r.totalPrice || 0;
      continue;
    }
    if (!["captured", "partially_refunded", "refunded"].includes(r.paymentStatus)) continue;

    const capturedAt = r.capturedAt || r.createdAt;
    if (!capturedAt) continue;
    const payDate = payoutDateFor(jstDay(capturedAt));
    const gross = r.paymentAmount || 0;
    const refunded = r.refundedAmount || 0;
    if (!groups[payDate]) groups[payDate] = { date: payDate, count: 0, gross: 0, refunded: 0, fee: 0 };
    const g = groups[payDate];
    g.count += 1;
    g.gross += gross;
    g.refunded += refunded;
    g.fee += Math.floor(gross * feeRate(r));
  }

  // 繰越（振込対象額が1万円未満なら次回へ）を考慮して、日付順に並べる。
  const payouts = [];
  let carry = 0;
  let carryFrom = [];
  for (const g of Object.values(groups).sort((a, b) => a.date.localeCompare(b.date))) {
    const sales = g.gross - g.refunded;
    const beforeTransferFee = sales - g.fee + carry;
    const transferFee = settings.transferFee;
    const entry = { ...g, sales, carriedIn: carry, carriedFrom: carryFrom.slice() };
    if (beforeTransferFee < settings.minPayout) {
      entry.carriedOut = beforeTransferFee;
      entry.transferFee = 0;
      entry.net = 0;
      carry = beforeTransferFee;
      carryFrom = [...carryFrom, g.date];
    } else {
      entry.carriedOut = 0;
      entry.transferFee = transferFee;
      entry.net = beforeTransferFee - transferFee;
      carry = 0;
      carryFrom = [];
    }
    payouts.push(entry);
  }
  return { payouts, pendingAuth };
}

module.exports = { DEFAULTS, KEYS, loadPayoutSettings, buildPayoutForecast, payoutDateFor };
