import { NextResponse } from "next/server";
const { load, save } = require("../../../../../lib/store");

export const dynamic = "force-dynamic";

const VALID_CONFIRMATION = ["auto", "manual", "inquiry_only"];

export async function PATCH(request, { params }) {
  const body = await request.json();
  const data = await load();
  const plan = data.plans.find((p) => p.id === params.id);
  if (!plan) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (body.name !== undefined) plan.name = body.name;
  if (body.description !== undefined) plan.description = body.description;
  if (body.basePrice !== undefined) plan.basePrice = Number(body.basePrice) || 0;
  if (body.minGuests !== undefined) plan.minGuests = Number(body.minGuests) || 1;
  if (body.maxGuests !== undefined) plan.maxGuests = Number(body.maxGuests) || plan.minGuests;
  if (body.bookingOpenDaysBefore !== undefined) {
    plan.bookingOpenDaysBefore =
      body.bookingOpenDaysBefore === "" || body.bookingOpenDaysBefore === null
        ? null
        : Number(body.bookingOpenDaysBefore);
  }
  if (body.finalBookingDeadlineDaysBefore !== undefined) {
    plan.finalBookingDeadlineDaysBefore =
      body.finalBookingDeadlineDaysBefore === "" || body.finalBookingDeadlineDaysBefore === null
        ? null
        : Number(body.finalBookingDeadlineDaysBefore);
  }
  if (body.slotPrices !== undefined) {
    if (body.slotPrices === null) {
      plan.slotPrices = null;
    } else {
      const { slot_am, slot_pm, slot_full } = body.slotPrices;
      plan.slotPrices = {
        slot_am: slot_am === "" || slot_am === null || slot_am === undefined ? plan.basePrice : Number(slot_am),
        slot_pm: slot_pm === "" || slot_pm === null || slot_pm === undefined ? plan.basePrice : Number(slot_pm),
        slot_full: slot_full === "" || slot_full === null || slot_full === undefined ? plan.basePrice : Number(slot_full),
      };
    }
  }

  if (body.confirmation) {
    const { weekday, weekend_holiday: weekendHoliday } = body.confirmation;
    if (weekday && !VALID_CONFIRMATION.includes(weekday)) {
      return NextResponse.json({ error: "invalid_confirmation_weekday" }, { status: 400 });
    }
    if (weekendHoliday && !VALID_CONFIRMATION.includes(weekendHoliday)) {
      return NextResponse.json({ error: "invalid_confirmation_weekend" }, { status: 400 });
    }

    // 常に weekday / weekend_holiday を明示的なルールとして持たせる（'all'頼みの曖昧さを解消）
    data.planConfirmationRules = data.planConfirmationRules.filter((r) => r.planId !== plan.id);
    data.planConfirmationRules.push(
      { planId: plan.id, dayType: "weekday", confirmationType: weekday || "manual" },
      { planId: plan.id, dayType: "weekend_holiday", confirmationType: weekendHoliday || "manual" }
    );
  }

  await save(data);
  return NextResponse.json({ ok: true });
}
