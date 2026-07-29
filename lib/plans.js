const { load } = require("./store");

function attachRelations(data, plan) {
  if (!plan) return plan;
  const resourceIds = data.planResources.filter((pr) => pr.planId === plan.id).map((pr) => pr.resourceId);
  const resources = data.resources
    .filter((r) => resourceIds.includes(r.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const optionIds = data.planOptions.filter((po) => po.planId === plan.id);
  const options = optionIds
    .map((po) => {
      const opt = data.options.find((o) => o.id === po.optionId);
      return opt ? { ...opt, is_default: po.isDefault } : null;
    })
    .filter(Boolean);

  const confirmationRules = data.planConfirmationRules
    .filter((r) => r.planId === plan.id)
    .map((r) => ({ day_type: r.dayType, confirmation_type: r.confirmationType }));

  return {
    id: plan.id,
    code: plan.code,
    category: plan.category,
    name: plan.name,
    exclusivity: plan.exclusivity,
    time_type: plan.timeType,
    min_guests: plan.minGuests,
    max_guests: plan.maxGuests,
    base_price: plan.basePrice,
    description: plan.description,
    booking_open_days_before: plan.bookingOpenDaysBefore,
    final_booking_deadline_days_before:
      plan.finalBookingDeadlineDaysBefore === undefined ? null : plan.finalBookingDeadlineDaysBefore,
    slot_prices: plan.slotPrices || null,
    resources,
    options,
    confirmationRules,
  };
}

async function listPlans(category) {
  const data = await load();
  const plans = data.plans
    .filter((p) => (category ? p.category === category : true))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return plans.map((p) => attachRelations(data, p));
}

async function getPlan(id) {
  const data = await load();
  const plan = data.plans.find((p) => p.id === id);
  return attachRelations(data, plan);
}

module.exports = { listPlans, getPlan };
