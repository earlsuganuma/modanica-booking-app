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

/**
 * プランの時間帯タイプと入力値から start_datetime / end_datetime / nightDates を算出する。
 */
function resolveDatetime({ timeType, date, slotId, startTime, endTime }) {
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
    case "stay_16_11":
      return {
        start: `${date}T16:00`,
        end: `${addDays(date, 1)}T11:00`,
        nightDates: [date],
      };
    case "slot3": {
      const slot = SLOT3_OPTIONS.find((s) => s.id === slotId) || SLOT3_OPTIONS[2];
      return {
        start: `${date}T${slot.start}`,
        end: `${date}T${slot.end}`,
        nightDates: [date],
      };
    }
    case "flexible":
    default:
      return {
        start: `${date}T${startTime || "11:00"}`,
        end: `${date}T${endTime || "13:00"}`,
        nightDates: [date],
      };
  }
}

module.exports = { resolveDatetime, SLOT3_OPTIONS, addDays };
