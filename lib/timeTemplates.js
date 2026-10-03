function addDays(dateStr, n) {
  // ローカル日時のまま加算する（toISOString()はUTC変換されJSTでは日付がずれるため使わない）
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const SLOT3_OPTIONS = [
  { id: "slot_am", label: "11:00〜16:00", start: "11:00", end: "16:00" },
  { id: "slot_pm", label: "17:00〜22:00", start: "17:00", end: "22:00" },
  { id: "slot_full", label: "11:00〜22:00", start: "11:00", end: "22:00" },
];

// flexible（開始時刻のみ指定）タイプのプランごとの固定利用時間（時間単位）。
// 終了時刻はお客様に選択させず、開始時刻＋この時間で自動計算する（営業終了時刻でクランプ）。
const FLEXIBLE_DURATION_HOURS = {
  p6: 4, // 飲み会貸切（8名以上）
  p7: 4, // 飲み会（4〜7名）
  p8: 4, // ディナーコース・BBQプラン
  p9: 2, // 通常カフェ利用（席確保）
};
const DEFAULT_FLEXIBLE_DURATION_HOURS = 2;
const CLOSE_TIME = "22:00";

function flexibleDurationHours(planId) {
  return FLEXIBLE_DURATION_HOURS[planId] ?? DEFAULT_FLEXIBLE_DURATION_HOURS;
}

/**
 * 開始時刻＋固定利用時間から終了時刻を算出する（営業終了時刻22:00でクランプ）。
 */
function computeFlexibleEndTime(planId, startTime) {
  const hours = flexibleDurationHours(planId);
  const [h, m] = (startTime || "11:00").split(":").map(Number);
  const closeMinutes = (() => {
    const [ch, cm] = CLOSE_TIME.split(":").map(Number);
    return ch * 60 + cm;
  })();
  const totalMinutes = Math.min(h * 60 + m + hours * 60, closeMinutes);
  const endH = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const endM = String(totalMinutes % 60).padStart(2, "0");
  return `${endH}:${endM}`;
}

// 部屋のみ貸すプラン（stay_16_11）で選択できる宿泊日数の範囲。
const MIN_NIGHTS = 1;
const MAX_NIGHTS = 7;

function clampNights(nights) {
  const n = Math.round(Number(nights));
  if (!Number.isFinite(n)) return MIN_NIGHTS;
  return Math.min(MAX_NIGHTS, Math.max(MIN_NIGHTS, n));
}

/**
 * プランの時間帯タイプと入力値から start_datetime / end_datetime / nightDates を算出する。
 */
function resolveDatetime({ timeType, date, slotId, startTime, nights, planId }) {
  switch (timeType) {
    case "stay_11_11":
      return {
        start: `${date}T11:00`,
        end: `${addDays(date, 1)}T11:00`,
        nightDates: [date],
      };
    case "stay_18_11":
      return {
        start: `${date}T18:00`,
        end: `${addDays(date, 1)}T11:00`,
        nightDates: [date],
      };
    case "stay_16_11": {
      // 部屋のみ貸すプラン（4名部屋のみ利用・簡易部屋のみ利用）は1〜7泊の連泊に対応する。
      const n = clampNights(nights);
      return {
        start: `${date}T16:00`,
        end: `${addDays(date, n)}T11:00`,
        nightDates: Array.from({ length: n }, (_, i) => addDays(date, i)),
      };
    }
    case "slot3": {
      const slot = SLOT3_OPTIONS.find((s) => s.id === slotId) || SLOT3_OPTIONS[2];
      return {
        start: `${date}T${slot.start}`,
        end: `${date}T${slot.end}`,
        nightDates: [date],
      };
    }
    case "flexible":
    default: {
      const start = startTime || "11:00";
      // 終了時刻はお客様に選択させず、プランごとの固定利用時間から自動算出する
      // （クライアントから送られてきた endTime は信用しない）。
      const end = computeFlexibleEndTime(planId, start);
      return {
        start: `${date}T${start}`,
        end: `${date}T${end}`,
        nightDates: [date],
      };
    }
  }
}

module.exports = {
  resolveDatetime,
  SLOT3_OPTIONS,
  addDays,
  MIN_NIGHTS,
  MAX_NIGHTS,
  flexibleDurationHours,
  computeFlexibleEndTime,
};
