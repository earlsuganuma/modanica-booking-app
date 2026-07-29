const { load, save, defaultData, exists } = require("../lib/store");

const FORCE = process.argv.includes("--force");

const resources = [
  { id: "room_a", name: "中部屋", capacity: 4, note: "SDベッド＋Dベッド、連結可。宿泊専用", sortOrder: 1 },
  { id: "room_b", name: "小部屋（和室）", capacity: 3, note: "シングルベッド1＋マットレス2。カフェ営業時は客席、宿泊時は襖で個室化", sortOrder: 2 },
  { id: "bbq", name: "BBQエリア", capacity: null, note: "屋外BBQスペース", sortOrder: 3 },
  { id: "cafe", name: "カフェ・バールーム", capacity: null, note: "共用飲食スペース", sortOrder: 4 },
];

const plans = [
  {
    id: "p1", code: 1, category: "facility", name: "BBQ＋宿泊貸切",
    exclusivity: "full_house", timeType: "stay_11_11",
    minGuests: 1, maxGuests: 7, basePrice: 60000,
    description: "IN 11:00 / OUT 翌11:00。BBQエリア・中部屋・小部屋・カフェ全体を貸切。食材は持込または食材セット手配（オプション）から選択。",
    bookingOpenDaysBefore: null, finalBookingDeadlineDaysBefore: 3, sortOrder: 1,
    resourceIds: ["room_a", "room_b", "bbq", "cafe"],
  },
  {
    id: "p2", code: 2, category: "facility", name: "飲み会＋宿泊貸切",
    exclusivity: "full_house", timeType: "stay_18_11",
    minGuests: 1, maxGuests: 7, basePrice: 55000,
    description: "IN 18:00 / OUT 翌11:00。カフェ全体・中部屋・小部屋を貸切。",
    bookingOpenDaysBefore: null, finalBookingDeadlineDaysBefore: 3, sortOrder: 2,
    resourceIds: ["room_a", "room_b", "cafe"],
  },
  {
    id: "p3", code: 3, category: "facility", name: "4名部屋のみ利用",
    exclusivity: "room", timeType: "stay_16_11",
    minGuests: 1, maxGuests: 4, basePrice: 18000,
    description: "IN 16:00 / OUT 翌11:00。中部屋のみ。他のお客様のカフェ利用は通常通り営業。",
    bookingOpenDaysBefore: null, finalBookingDeadlineDaysBefore: 1, sortOrder: 3,
    resourceIds: ["room_a"],
  },
  {
    id: "p4", code: 4, category: "facility", name: "簡易部屋のみ利用",
    exclusivity: "room", timeType: "stay_16_11",
    minGuests: 1, maxGuests: 3, basePrice: 14000,
    description: "IN 16:00 / OUT 翌11:00。小部屋（和室）のみ。",
    bookingOpenDaysBefore: null, finalBookingDeadlineDaysBefore: 1, sortOrder: 4,
    resourceIds: ["room_b"],
  },
  {
    id: "p5", code: 5, category: "facility", name: "BBQレンタルスペース貸切",
    exclusivity: "area", timeType: "slot3",
    minGuests: 1, maxGuests: 20, basePrice: 8000,
    slotPrices: { slot_am: 8000, slot_pm: 10000, slot_full: 15000 },
    description: "11:00-16:00 / 17:00-22:00 / 11:00-22:00 の3枠から選択。BBQエリアのみ貸切。枠ごとに料金が異なります。",
    bookingOpenDaysBefore: null, finalBookingDeadlineDaysBefore: 2, sortOrder: 5,
    resourceIds: ["bbq"],
  },
  {
    id: "p6", code: 6, category: "cafe", name: "飲み会貸切（8名以上）",
    exclusivity: "cafe_full", timeType: "flexible",
    minGuests: 8, maxGuests: 30, basePrice: 3000,
    description: "カフェ・バールーム全体を貸切（宿泊は含まない）。料金は1名あたりの目安。",
    bookingOpenDaysBefore: null, finalBookingDeadlineDaysBefore: 1, sortOrder: 6,
    resourceIds: ["cafe"],
  },
  {
    id: "p7", code: 7, category: "cafe", name: "飲み会（4〜7名）",
    exclusivity: "partial", timeType: "flexible",
    minGuests: 4, maxGuests: 7, basePrice: 2500,
    description: "カフェ・バールームの一部を利用。他のお客様と共用。料金は1名あたりの目安。",
    bookingOpenDaysBefore: 90, finalBookingDeadlineDaysBefore: null, sortOrder: 7,
    resourceIds: ["cafe"],
  },
  {
    id: "p8", code: 8, category: "cafe", name: "ディナーコース・BBQプラン",
    exclusivity: "partial", timeType: "flexible",
    minGuests: 1, maxGuests: 10, basePrice: 4500,
    description: "カフェ席またはBBQエリアの一部を利用。営業時間（11:00〜22:00）内で開始・終了時刻を指定。料金は1名あたりの目安。",
    bookingOpenDaysBefore: 90, finalBookingDeadlineDaysBefore: null, sortOrder: 8,
    resourceIds: ["cafe", "bbq"],
  },
  {
    id: "p9", code: 9, category: "cafe", name: "通常カフェ利用（席確保）",
    exclusivity: "partial", timeType: "flexible",
    minGuests: 1, maxGuests: 6, basePrice: 1000,
    description: "カフェ席の一部を利用。料金は1名あたりの目安。",
    bookingOpenDaysBefore: 30, finalBookingDeadlineDaysBefore: null, sortOrder: 9,
    resourceIds: ["cafe"],
  },
];

// unit: "flag"（チェックのみ・選択可否） or "quantity"（個数を指定）。quantity の場合 unitLabel（人/個/枚/セット/束/回 等）を表示に使う
const options = [
  { id: "opt_bring", name: "持込（デフォルト）", price: 0, unit: "flag", maxQuantity: null, unitLabel: null, description: "BBQの食材をお客様にてご持参いただきます。" },
  { id: "opt_bbq_set", name: "食材セット手配", price: 3000, unit: "flag", maxQuantity: null, unitLabel: null, description: "当店にてBBQ食材セットをご用意します（1名あたり）。" },
];

const planOptions = [
  { planId: "p1", optionId: "opt_bring", isDefault: true },
  { planId: "p1", optionId: "opt_bbq_set", isDefault: false },
];

// 初期運用方針：全プラン「要確認」がデフォルト
const confirmationRules = plans.map((p) => ({ planId: p.id, dayType: "all", confirmationType: "manual" }));
confirmationRules.push(
  { planId: "p9", dayType: "weekday", confirmationType: "manual" },
  { planId: "p9", dayType: "weekend_holiday", confirmationType: "manual" }
);

// 2026年（令和8年）の国民の祝日・休日（国立天文台 暦要項に基づく）。単発の祝日は係数を週末と同等の1.2に設定。
const holidays2026 = [
  ["2026-01-01", "元日"],
  ["2026-01-12", "成人の日"],
  ["2026-02-11", "建国記念の日"],
  ["2026-02-23", "天皇誕生日"],
  ["2026-03-20", "春分の日"],
  ["2026-04-29", "昭和の日"],
  ["2026-05-03", "憲法記念日"],
  ["2026-05-04", "みどりの日"],
  ["2026-05-05", "こどもの日"],
  ["2026-05-06", "振替休日"],
  ["2026-07-20", "海の日"],
  ["2026-08-11", "山の日"],
  ["2026-09-21", "敬老の日"],
  ["2026-09-22", "国民の休日"],
  ["2026-09-23", "秋分の日"],
  ["2026-10-12", "スポーツの日"],
  ["2026-11-03", "文化の日"],
  ["2026-11-23", "勤労感謝の日"],
];

let priceRuleId = 1;
const priceRules = holidays2026.map(([date, label]) => ({
  id: priceRuleId++,
  label,
  startDate: date,
  endDate: date,
  coefficient: 1.2,
  type: "holiday",
}));

// ハイシーズン例（GW・夏休み・年末年始）。管理画面から追加・編集・削除できる。
priceRules.push(
  { id: priceRuleId++, label: "GW", startDate: "2026-04-29", endDate: "2026-05-06", coefficient: 1.3, type: "season" },
  { id: priceRuleId++, label: "夏休みハイシーズン", startDate: "2026-08-01", endDate: "2026-08-16", coefficient: 1.5, type: "season" },
  { id: priceRuleId++, label: "年末年始", startDate: "2026-12-29", endDate: "2027-01-03", coefficient: 1.5, type: "season" }
);

async function seed() {
  // 既にデータ（料金・プラン設定・予約など）が保存されている場合は、
  // バージョンアップ時に誤って上書き・消去してしまわないよう、デフォルトではスキップする。
  // 初期状態にリセットしたい場合だけ `npm run seed -- --force` を使う。
  if ((await exists()) && !FORCE) {
    console.log(
      "既存のデータが見つかったため、シードをスキップしました（接続先: DATABASE_URL）。\n" +
        "初期状態に戻したい場合は `npm run seed -- --force` を実行してください（既存の予約・設定は失われます）。"
    );
    return;
  }

  const data = defaultData();

  data.resources = resources;

  data.plans = plans.map((p) => ({
    id: p.id,
    code: p.code,
    category: p.category,
    name: p.name,
    exclusivity: p.exclusivity,
    timeType: p.timeType,
    minGuests: p.minGuests,
    maxGuests: p.maxGuests,
    basePrice: p.basePrice,
    description: p.description,
    bookingOpenDaysBefore: p.bookingOpenDaysBefore,
    finalBookingDeadlineDaysBefore: p.finalBookingDeadlineDaysBefore,
    slotPrices: p.slotPrices || null,
    sortOrder: p.sortOrder,
  }));

  data.planResources = plans.flatMap((p) => p.resourceIds.map((resourceId) => ({ planId: p.id, resourceId })));
  data.options = options;
  data.planOptions = planOptions;
  data.planConfirmationRules = confirmationRules;
  data.reservations = [];
  data.blockHolds = [];
  data.priceRules = priceRules;
  data.nextReservationId = 1;
  data.nextPriceRuleId = priceRuleId;
  data.nextOptionSeq = 1;

  await save(data);
  console.log(
    "Seed complete:",
    data.plans.length, "plans,",
    data.resources.length, "resources,",
    data.priceRules.length, "price rules."
  );
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
