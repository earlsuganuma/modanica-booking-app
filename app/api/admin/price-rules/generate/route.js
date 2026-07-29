import { NextResponse } from "next/server";
const { load, save } = require("../../../../../lib/store");
const { computeJapanHolidays, computeSeasonSuggestions } = require("../../../../../lib/holidays");

export const dynamic = "force-dynamic";

// body: { year: number, includeSeasons?: boolean, coefficient?: number }
export async function POST(request) {
  const body = await request.json();
  const year = Number(body.year);
  if (!year || year < 1980 || year > 2099) {
    return NextResponse.json({ error: "invalid_year" }, { status: 400 });
  }
  const includeSeasons = body.includeSeasons !== false;
  const holidayCoefficient = Number(body.coefficient) || 1.2;

  const data = await load();
  let id = data.nextPriceRuleId || 1;

  const existingHolidayDates = new Set(
    data.priceRules.filter((r) => r.type === "holiday").map((r) => r.startDate)
  );
  const holidays = computeJapanHolidays(year);
  const newHolidayRules = holidays
    .filter((h) => !existingHolidayDates.has(h.date))
    .map((h) => ({
      id: id++,
      label: h.label,
      startDate: h.date,
      endDate: h.date,
      coefficient: holidayCoefficient,
      type: "holiday",
    }));

  let newSeasonRules = [];
  if (includeSeasons) {
    const existingSeasonLabels = new Set(data.priceRules.filter((r) => r.type === "season").map((r) => r.label));
    newSeasonRules = computeSeasonSuggestions(year, holidays)
      .filter((s) => !existingSeasonLabels.has(s.label))
      .map((s) => ({ ...s, id: id++ }));
  }

  data.priceRules.push(...newHolidayRules, ...newSeasonRules);
  data.nextPriceRuleId = id;
  await save(data);

  return NextResponse.json({
    createdHolidays: newHolidayRules.length,
    createdSeasons: newSeasonRules.length,
    skippedHolidays: holidays.length - newHolidayRules.length,
  });
}
