// データストア（PostgreSQL版）。
// 以前はJSONファイル1本に全データを保存していたが、本格運用に向けてPostgreSQLに移行した。
// load()/save() が返す・受け取るオブジェクトの「形」は、移行前のJSONファイル時代とまったく同じに保っている
// （resources/plans/planResources/... のキャメルケース構造）。これにより、この2関数を呼び出す側
// （APIルートなど）は「同期→非同期（await）」にするだけで済み、個々のロジックの書き換えは不要にしている。

const { query, withTransaction } = require("./db");
const { types } = require("pg");

// DATE型（コミット時刻なしの日付だけの型）は、タイムゾーン変換で意図しない日付ズレが起きないよう、
// JSのDateに変換せず "YYYY-MM-DD" の文字列のまま受け取る。
types.setTypeParser(1082, (val) => val);

function defaultData() {
  return {
    resources: [],
    plans: [],
    planResources: [],
    planConfirmationRules: [],
    options: [],
    planOptions: [],
    reservations: [],
    blockHolds: [],
    priceRules: [],
    mailLog: [],
    nextReservationId: 1,
    nextPriceRuleId: 1,
    nextOptionSeq: 1,
    nextMailLogId: 1,
  };
}

function toIso(value) {
  // created_at など、実際のタイムスタンプ（TIMESTAMPTZ = 絶対時刻）用。
  if (!value) return value;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function toNaiveDatetime(value) {
  // start_datetime / end_datetime は「タイムゾーンなしの壁時計時刻」を表すTIMESTAMP列。
  // pgドライバはこれをUTC基準のDateオブジェクトとして返す（=年月日時分は常に元の値と一致する）ため、
  // toISOString()した上で秒・ミリ秒・Zを切り落とし、アプリ内部の慣習である
  // "YYYY-MM-DDTHH:MM" 形式（resolveDatetime()が生成するのと同じ形）に揃える。
  if (!value) return value;
  if (value instanceof Date) return value.toISOString().slice(0, 16);
  return value;
}

async function load() {
  const [
    resourcesRes,
    plansRes,
    planResourcesRes,
    confirmationRulesRes,
    optionsRes,
    planOptionsRes,
    reservationsRes,
    blockHoldsRes,
    priceRulesRes,
    mailLogRes,
    countersRes,
  ] = await Promise.all([
    query("SELECT * FROM resources ORDER BY sort_order"),
    query("SELECT * FROM plans ORDER BY sort_order"),
    query("SELECT * FROM plan_resources"),
    query("SELECT * FROM plan_confirmation_rules"),
    query("SELECT * FROM options"),
    query("SELECT * FROM plan_options"),
    query("SELECT * FROM reservations ORDER BY id"),
    query("SELECT * FROM block_holds ORDER BY id"),
    query("SELECT * FROM price_rules ORDER BY id"),
    query("SELECT * FROM mail_log ORDER BY id"),
    query("SELECT * FROM counters"),
  ]);

  const counters = {};
  for (const row of countersRes.rows) counters[row.name] = row.value;

  return {
    resources: resourcesRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      capacity: r.capacity,
      note: r.note,
      sortOrder: r.sort_order,
    })),
    plans: plansRes.rows.map((p) => ({
      id: p.id,
      code: p.code,
      category: p.category,
      name: p.name,
      exclusivity: p.exclusivity,
      timeType: p.time_type,
      minGuests: p.min_guests,
      maxGuests: p.max_guests,
      basePrice: p.base_price,
      description: p.description,
      bookingOpenDaysBefore: p.booking_open_days_before,
      finalBookingDeadlineDaysBefore: p.final_booking_deadline_days_before,
      slotPrices: p.slot_prices,
      sortOrder: p.sort_order,
    })),
    planResources: planResourcesRes.rows.map((pr) => ({ planId: pr.plan_id, resourceId: pr.resource_id })),
    planConfirmationRules: confirmationRulesRes.rows.map((r) => ({
      planId: r.plan_id,
      dayType: r.day_type,
      confirmationType: r.confirmation_type,
    })),
    options: optionsRes.rows.map((o) => ({
      id: o.id,
      name: o.name,
      price: o.price,
      unit: o.unit,
      maxQuantity: o.max_quantity,
      unitLabel: o.unit_label,
      description: o.description,
    })),
    planOptions: planOptionsRes.rows.map((po) => ({
      planId: po.plan_id,
      optionId: po.option_id,
      isDefault: po.is_default,
    })),
    reservations: reservationsRes.rows.map((r) => ({
      id: r.id,
      planId: r.plan_id,
      resourceIds: r.resource_ids,
      optionIds: r.option_ids,
      optionQuantities: r.option_quantities,
      startDatetime: toNaiveDatetime(r.start_datetime),
      endDatetime: toNaiveDatetime(r.end_datetime),
      guestCount: r.guest_count,
      customerName: r.customer_name,
      customerEmail: r.customer_email,
      customerTel: r.customer_tel,
      note: r.note,
      status: r.status,
      totalPrice: r.total_price,
      createdAt: toIso(r.created_at),
    })),
    blockHolds: blockHoldsRes.rows.map((b) => b.data),
    priceRules: priceRulesRes.rows.map((pr) => ({
      id: pr.id,
      label: pr.label,
      startDate: pr.start_date,
      endDate: pr.end_date,
      coefficient: parseFloat(pr.coefficient),
      type: pr.type,
    })),
    mailLog: mailLogRes.rows.map((m) => ({
      id: m.id,
      type: m.type,
      to: m.to,
      subject: m.subject,
      body: m.body,
      status: m.status,
      error: m.error,
      createdAt: toIso(m.created_at),
    })),
    nextReservationId: counters.nextReservationId || 1,
    nextPriceRuleId: counters.nextPriceRuleId || 1,
    nextOptionSeq: counters.nextOptionSeq || 1,
    nextMailLogId: counters.nextMailLogId || 1,
  };
}

async function save(data) {
  const d = { ...defaultData(), ...data };

  await withTransaction(async (client) => {
    // 依存関係のある子テーブルから先に全消去する
    await client.query("DELETE FROM plan_resources");
    await client.query("DELETE FROM plan_confirmation_rules");
    await client.query("DELETE FROM plan_options");
    await client.query("DELETE FROM reservations");
    await client.query("DELETE FROM block_holds");
    await client.query("DELETE FROM price_rules");
    await client.query("DELETE FROM mail_log");
    await client.query("DELETE FROM plans");
    await client.query("DELETE FROM options");
    await client.query("DELETE FROM resources");

    for (const r of d.resources) {
      await client.query(
        `INSERT INTO resources (id, name, capacity, note, sort_order) VALUES ($1,$2,$3,$4,$5)`,
        [r.id, r.name, r.capacity ?? null, r.note ?? null, r.sortOrder ?? 0]
      );
    }

    for (const p of d.plans) {
      await client.query(
        `INSERT INTO plans (id, code, category, name, exclusivity, time_type, min_guests, max_guests, base_price, description, booking_open_days_before, final_booking_deadline_days_before, slot_prices, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          p.id,
          p.code ?? null,
          p.category,
          p.name,
          p.exclusivity,
          p.timeType,
          p.minGuests ?? null,
          p.maxGuests ?? null,
          p.basePrice ?? 0,
          p.description ?? null,
          p.bookingOpenDaysBefore ?? null,
          p.finalBookingDeadlineDaysBefore ?? null,
          p.slotPrices ? JSON.stringify(p.slotPrices) : null,
          p.sortOrder ?? 0,
        ]
      );
    }

    for (const o of d.options) {
      await client.query(
        `INSERT INTO options (id, name, price, unit, max_quantity, unit_label, description) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [o.id, o.name, o.price ?? 0, o.unit || "flag", o.maxQuantity ?? null, o.unitLabel ?? null, o.description ?? null]
      );
    }

    for (const pr of d.planResources) {
      await client.query(`INSERT INTO plan_resources (plan_id, resource_id) VALUES ($1,$2)`, [pr.planId, pr.resourceId]);
    }

    for (const r of d.planConfirmationRules) {
      await client.query(
        `INSERT INTO plan_confirmation_rules (plan_id, day_type, confirmation_type) VALUES ($1,$2,$3)`,
        [r.planId, r.dayType, r.confirmationType]
      );
    }

    for (const po of d.planOptions) {
      await client.query(`INSERT INTO plan_options (plan_id, option_id, is_default) VALUES ($1,$2,$3)`, [
        po.planId,
        po.optionId,
        !!po.isDefault,
      ]);
    }

    for (const r of d.reservations) {
      await client.query(
        `INSERT INTO reservations (id, plan_id, resource_ids, option_ids, option_quantities, start_datetime, end_datetime, guest_count, customer_name, customer_email, customer_tel, note, status, total_price, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          r.id,
          r.planId,
          JSON.stringify(r.resourceIds || []),
          JSON.stringify(r.optionIds || []),
          JSON.stringify(r.optionQuantities || {}),
          r.startDatetime,
          r.endDatetime,
          r.guestCount ?? null,
          r.customerName ?? null,
          r.customerEmail ?? null,
          r.customerTel ?? null,
          r.note ?? null,
          r.status || "pending_review",
          r.totalPrice ?? null,
          r.createdAt || new Date().toISOString(),
        ]
      );
    }

    for (const b of d.blockHolds) {
      await client.query(`INSERT INTO block_holds (data) VALUES ($1)`, [JSON.stringify(b)]);
    }

    for (const pr of d.priceRules) {
      await client.query(
        `INSERT INTO price_rules (id, label, start_date, end_date, coefficient, type) VALUES ($1,$2,$3,$4,$5,$6)`,
        [pr.id, pr.label, pr.startDate, pr.endDate, pr.coefficient ?? 1, pr.type || "custom"]
      );
    }

    for (const m of d.mailLog) {
      await client.query(
        `INSERT INTO mail_log (id, type, "to", subject, body, status, error, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [m.id, m.type, m.to, m.subject, m.body, m.status, m.error ?? null, m.createdAt || new Date().toISOString()]
      );
    }

    await client.query(
      `INSERT INTO counters (name, value) VALUES ('nextReservationId',$1),('nextPriceRuleId',$2),('nextOptionSeq',$3),('nextMailLogId',$4)
       ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
      [d.nextReservationId, d.nextPriceRuleId, d.nextOptionSeq, d.nextMailLogId]
    );
  });
}

async function exists() {
  const res = await query("SELECT 1 FROM plans LIMIT 1");
  return res.rows.length > 0;
}

module.exports = { load, save, defaultData, exists };
