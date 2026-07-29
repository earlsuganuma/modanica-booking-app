// 日本の国民の祝日を計算するユーティリティ（1980〜2099年で有効な近似式を使用）。
// 春分の日・秋分の日は国立天文台が毎年2月に翌々年分を官報で確定するため、
// ここでの計算値はあくまで推定。確定後は管理画面から個別に日付を編集できる。

function pad(n) {
  return String(n).padStart(2, "0");
}

function toDateStr(y, m, d) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function dateFromStr(s) {
  return new Date(`${s}T00:00:00`);
}

function addDaysToStr(s, n) {
  const d = dateFromStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function weekdayOfStr(s) {
  return dateFromStr(s).getDay(); // 0=Sun
}

function nthWeekdayOfMonth(year, month, weekday, n) {
  const first = new Date(year, month - 1, 1);
  const firstWeekday = first.getDay();
  const day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7;
  return day;
}

// 国立天文台の近似式（1980〜2099年で有効）
function springEquinoxDay(year) {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}
function autumnEquinoxDay(year) {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

const FIXED_HOLIDAYS = [
  [1, 1, "元日"],
  [2, 11, "建国記念の日"],
  [2, 23, "天皇誕生日"],
  [4, 29, "昭和の日"],
  [5, 3, "憲法記念日"],
  [5, 4, "みどりの日"],
  [5, 5, "こどもの日"],
  [8, 11, "山の日"],
  [11, 3, "文化の日"],
  [11, 23, "勤労感謝の日"],
];

// [月, 第n月曜, 名称]
const HAPPY_MONDAY_HOLIDAYS = [
  [1, 2, "成人の日"],
  [7, 3, "海の日"],
  [9, 3, "敬老の日"],
  [10, 2, "スポーツの日"],
];

function computeJapanHolidays(year) {
  let list = [];

  for (const [m, d, label] of FIXED_HOLIDAYS) {
    list.push({ date: toDateStr(year, m, d), label });
  }
  for (const [m, n, label] of HAPPY_MONDAY_HOLIDAYS) {
    const day = nthWeekdayOfMonth(year, m, 1, n);
    list.push({ date: toDateStr(year, m, day), label });
  }
  list.push({ date: toDateStr(year, 3, springEquinoxDay(year)), label: "春分の日" });
  list.push({ date: toDateStr(year, 9, autumnEquinoxDay(year)), label: "秋分の日" });

  list.sort((a, b) => a.date.localeCompare(b.date));

  // 振替休日：祝日が日曜の場合、直後の（祝日でない）平日を休日とする
  const dateSet = new Set(list.map((h) => h.date));
  const substitutes = [];
  for (const h of list) {
    if (weekdayOfStr(h.date) === 0) {
      let candidate = addDaysToStr(h.date, 1);
      while (dateSet.has(candidate) || substitutes.some((s) => s.date === candidate)) {
        candidate = addDaysToStr(candidate, 1);
      }
      substitutes.push({ date: candidate, label: "振替休日" });
    }
  }
  list.push(...substitutes);
  list.sort((a, b) => a.date.localeCompare(b.date));

  // 国民の休日：前後を祝日に挟まれた（祝日でも日曜でもない）平日を休日とする
  const allDates = new Set(list.map((h) => h.date));
  const citizens = [];
  for (const h of list) {
    const between = addDaysToStr(h.date, 1);
    const nextNext = addDaysToStr(h.date, 2);
    if (allDates.has(nextNext) && !allDates.has(between) && weekdayOfStr(between) !== 0) {
      citizens.push({ date: between, label: "国民の休日" });
    }
  }
  list.push(...citizens);
  list.sort((a, b) => a.date.localeCompare(b.date));

  return list;
}

function computeSeasonSuggestions(year, holidays) {
  const gwCandidates = holidays
    .map((h) => h.date)
    .filter((d) => d >= toDateStr(year, 4, 29) && d <= toDateStr(year, 5, 10))
    .sort();
  const gwEnd = gwCandidates.length ? gwCandidates[gwCandidates.length - 1] : toDateStr(year, 5, 5);

  return [
    { label: `${year}年 GW`, startDate: toDateStr(year, 4, 29), endDate: gwEnd, coefficient: 1.3, type: "season" },
    { label: `${year}年 夏休みハイシーズン`, startDate: toDateStr(year, 8, 1), endDate: toDateStr(year, 8, 16), coefficient: 1.5, type: "season" },
    { label: `${year}年末年始`, startDate: toDateStr(year, 12, 29), endDate: toDateStr(year + 1, 1, 3), coefficient: 1.5, type: "season" },
  ];
}

module.exports = { computeJapanHolidays, computeSeasonSuggestions };
