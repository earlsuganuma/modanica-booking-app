// 長野県宿泊税（2026年6月1日〜）の目安計算。現地払い（宿泊料金・決済額には含めない）。
//
// ・宿泊者1人1泊あたりの宿泊料金（消費税抜き）が 6,000円以上 → 1人1泊 200円。6,000円未満は課税されない。
// ・当システムの宿泊プランは、料金が「部屋単位（人数別）」のため、「室料 ÷ 人数」を1人あたりの宿泊料金とみなして判定する。
//   子供（4〜12歳）は、4名部屋・簡易部屋（stay_16_11）で、大人の70%の料金なので、その金額で判定する。
// ・料金は消費税込みなので、税抜は ÷1.1 で求める（6,000円以上 ＝ 税込 6,600円以上）。
// ・オプション料金は含めない（宿泊料金のみで判定）。
// 税率・免税点が変わったら、下の定数を直す（2029年6月1日から 300円に変わる予定）。
const { coefficientOf } = require("./pricing");

const TAX_PER_PERSON_NIGHT = 200;
const EXEMPT_BELOW_EXCL_TAX = 6000; // 税抜 6,000円未満は免税
const CONSUMPTION_TAX_RATE = 0.1;
const CHILD_RATIO = 0.7; // lib/pricing.js の CHILD_PRICE_RATIO と同じ

function pad2(n) {
  return String(n).padStart(2, "0");
}
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function planField(plan, snake, camel) {
  if (!plan) return undefined;
  return plan[snake] !== undefined ? plan[snake] : plan[camel];
}

function isTaxable(ratePerPersonInclTax) {
  const excl = Math.round(ratePerPersonInclTax) / (1 + CONSUMPTION_TAX_RATE);
  return excl >= EXEMPT_BELOW_EXCL_TAX - 1e-9;
}

/**
 * @returns {{applicable:boolean, total:number, taxableHeadNights:number, nights:number, perNight:Array}}
 *   applicable=false：宿泊プランではない（宿泊税の対象外のプラン）
 */
function lodgingTax({ plan, nightDates, guestCount, childrenCount = 0, priceRules = [] }) {
  const timeType = planField(plan, "time_type", "timeType") || "";
  const none = { applicable: false, total: 0, taxableHeadNights: 0, nights: 0, perNight: [] };
  if (!timeType.startsWith("stay_") || !Array.isArray(nightDates) || !nightDates.length) return none;
  const guests = Math.max(0, Math.floor(Number(guestCount) || 0));
  if (!guests) return { ...none, applicable: true };

  const guestPrices = planField(plan, "guest_prices", "guestPrices");
  const base = Number(planField(plan, "base_price", "basePrice")) || 0;
  const roomPrice = guestPrices && guestPrices[String(guests)] != null ? Number(guestPrices[String(guests)]) : base;

  const kids = Math.min(Math.max(0, Math.floor(Number(childrenCount) || 0)), guests);
  const adults = guests - kids;
  const childDiscount = timeType === "stay_16_11"; // 子供70%は、4名部屋・簡易部屋のみ
  const adultRate = roomPrice / guests;
  const childRate = childDiscount ? adultRate * CHILD_RATIO : adultRate;

  let total = 0;
  let headNights = 0;
  const perNight = nightDates.map((d) => {
    const coef = coefficientOf(d, priceRules);
    const a = isTaxable(adultRate * coef) ? adults : 0;
    const c = isTaxable(childRate * coef) ? kids : 0;
    const count = a + c;
    total += count * TAX_PER_PERSON_NIGHT;
    headNights += count;
    return { date: d, taxableCount: count, tax: count * TAX_PER_PERSON_NIGHT };
  });
  return { applicable: true, total, taxableHeadNights: headNights, nights: nightDates.length, perNight };
}

// 保存済みの予約から計算する（メール・管理画面用）。reservation は camelCase の予約オブジェクト。
function lodgingTaxForReservation(reservation, plan, priceRules = []) {
  if (!reservation || !reservation.startDatetime || !reservation.endDatetime) return null;
  const startDate = String(reservation.startDatetime).slice(0, 10);
  const endDate = String(reservation.endDatetime).slice(0, 10);
  const nightDates = [];
  for (let d = startDate, i = 0; d < endDate && i < 60; d = addDays(d, 1), i++) nightDates.push(d);
  return lodgingTax({
    plan,
    nightDates,
    guestCount: reservation.guestCount,
    childrenCount: reservation.guestChildren || 0,
    priceRules,
  });
}

// 画面・メールに出す1行（対象外のプランは空文字）。
function lodgingTaxLine(tax) {
  if (!tax || !tax.applicable) return "";
  if (tax.total <= 0) return "長野県宿泊税：対象外（宿泊料金が1人1泊6,000円（税抜）未満のため）";
  const how =
    tax.nights <= 1
      ? `1名1泊¥${TAX_PER_PERSON_NIGHT} × ${tax.taxableHeadNights}名`
      : `1名1泊¥${TAX_PER_PERSON_NIGHT} × 延べ${tax.taxableHeadNights}名・泊`;
  return `長野県宿泊税：¥${tax.total.toLocaleString()}（${how}）※宿泊料金とは別に、現地でお支払いください`;
}

module.exports = { lodgingTax, lodgingTaxForReservation, lodgingTaxLine, TAX_PER_PERSON_NIGHT };
