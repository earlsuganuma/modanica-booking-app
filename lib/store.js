// データストア（PostgreSQL版）。
// 以前はJSONファイル1本に全データを保存していたが、本格運用に向けてPostgreSQLに移行した。
// load()/save() が返す・受け取るオブジェクトの「形」は、移行前のJSONファイル時代とまったく同じに保っている
// （resources/plans/planResources/... のキャメルケース構造）。これにより、この2関数を呼び出す側
// （APIルートなど）は「同期→非同期（await）」にするだけで済み、個々のロジックの書き換えは不要にしている。

const { query: dbQuery, withTransaction } = require("./db");
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

// client を渡すと、その接続（トランザクション）の中で読む（lib/reservationGuard.js が使う）
async function load(client) {
  const query = client ? (text, params) => client.query(text, params) : dbQuery;
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
    query("SELECT * FROM options ORDER BY sort_order"),
    query("SELECT * FROM plan_options"),
    query("SELECT * FROM reservations ORDER BY id"),
    query("SELECT * FROM block_holds ORDER BY id"),
    query("SELECT * FROM price_rules ORDER BY id"),
    query("SELECT * FROM mail_log ORDER BY id"),
    query("SELECT * FROM counters"),
  ]);

  const counters = {};
  for (const row of countersRes.rows) counters[row.name] = row.value;

  const data = {
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
      images: p.images || [],
      guestPrices: p.guest_prices || null,
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
      imageUrl: o.image_url,
      sortOrder: o.sort_order,
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
      guestMale: r.guest_male,
      guestFemale: r.guest_female,
      guestChildren: r.guest_children,
      customerName: r.customer_name,
      customerEmail: r.customer_email,
      customerTel: r.customer_tel,
      customerAddress: r.customer_address,
      note: r.note,
      status: r.status,
      totalPrice: r.total_price,
      createdAt: toIso(r.created_at),
      paymentStatus: r.payment_status || "none",
      payjpChargeId: r.payjp_charge_id,
      paymentAmount: r.payment_amount,
      refundedAmount: r.refunded_amount || 0,
      cardBrand: r.card_brand,
      cardLast4: r.card_last4,
      capturedAt: r.captured_at ? toIso(r.captured_at) : null,
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
  // save() が差分だけを書けるよう、読み込んだ時点の内容を控えておく（列挙されないので呼び出し側からは見えない）
  Object.defineProperty(data, SNAPSHOT, { value: snapshotOf(data), enumerable: false });
  return data;
}

// ---------- 保存（差分方式） ----------
// 以前の save() は「全テーブルを DELETE してから全件 INSERT し直す」方式だった。この方式には2つの問題があった：
//  1) load() から save() までの間に他のリクエストが書いた行（新しい予約など）が消える（後勝ちで全件上書き）
//  2) resources などを DELETE すると、外部キーの ON DELETE CASCADE で、ここで扱っていない別テーブル
//     （OTA 取り込みURLの ical_feeds など）まで連鎖して消える（2026-11-02 に取り込みURLが消えた原因）
// そこで load() 時点の内容（SNAPSHOT）と比べて、変わった行だけ UPDATE、新しい行だけ INSERT、
// 呼び出し側が配列から取り除いた行だけ DELETE する。ここで扱う11テーブル以外には一切触れない。
// 新しい行は ON CONFLICT なしで INSERT するので、同時採番で ID がぶつかった場合は黙って上書きせずにエラー（ロールバック）になる。

const SNAPSHOT = Symbol("storeSnapshot");

const iso = (v) => v || new Date().toISOString();

// テーブルごとの定義。key＝行を特定する列（null＝行全体が鍵＝変更はなく追加・削除だけ）、cols＝書き込む列、params＝列の値。
const TABLES = [
  {
    name: "resources",
    list: (d) => d.resources,
    cols: ["id", "name", "capacity", "note", "sort_order"],
    key: ["id"],
    params: (r) => [r.id, r.name, r.capacity ?? null, r.note ?? null, r.sortOrder ?? 0],
  },
  {
    name: "plans",
    list: (d) => d.plans,
    cols: ["id", "code", "category", "name", "exclusivity", "time_type", "min_guests", "max_guests", "base_price", "description",
      "booking_open_days_before", "final_booking_deadline_days_before", "slot_prices", "sort_order", "images", "guest_prices"],
    key: ["id"],
    params: (p) => [
      p.id, p.code ?? null, p.category, p.name, p.exclusivity, p.timeType, p.minGuests ?? null, p.maxGuests ?? null,
      p.basePrice ?? 0, p.description ?? null, p.bookingOpenDaysBefore ?? null, p.finalBookingDeadlineDaysBefore ?? null,
      p.slotPrices ? JSON.stringify(p.slotPrices) : null, p.sortOrder ?? 0, JSON.stringify(p.images || []),
      p.guestPrices ? JSON.stringify(p.guestPrices) : null,
    ],
  },
  {
    name: "options",
    list: (d) => d.options,
    cols: ["id", "name", "price", "unit", "max_quantity", "unit_label", "description", "image_url", "sort_order"],
    key: ["id"],
    params: (o) => [o.id, o.name, o.price ?? 0, o.unit || "flag", o.maxQuantity ?? null, o.unitLabel ?? null,
      o.description ?? null, o.imageUrl ?? null, o.sortOrder ?? 0],
  },
  {
    name: "plan_resources",
    list: (d) => d.planResources,
    cols: ["plan_id", "resource_id"],
    key: null,
    params: (pr) => [pr.planId, pr.resourceId],
  },
  {
    name: "plan_confirmation_rules",
    list: (d) => d.planConfirmationRules,
    cols: ["plan_id", "day_type", "confirmation_type"],
    key: null,
    params: (r) => [r.planId, r.dayType, r.confirmationType],
  },
  {
    name: "plan_options",
    list: (d) => d.planOptions,
    cols: ["plan_id", "option_id", "is_default"],
    key: ["plan_id", "option_id"],
    params: (po) => [po.planId, po.optionId, !!po.isDefault],
  },
  {
    name: "reservations",
    list: (d) => d.reservations,
    cols: ["id", "plan_id", "resource_ids", "option_ids", "option_quantities", "start_datetime", "end_datetime", "guest_count",
      "guest_male", "guest_female", "guest_children", "customer_name", "customer_email", "customer_tel", "customer_address",
      "note", "status", "total_price", "created_at", "payment_status", "payjp_charge_id", "payment_amount", "refunded_amount",
      "card_brand", "card_last4", "captured_at"],
    key: ["id"],
    params: (r) => [
      r.id, r.planId, JSON.stringify(r.resourceIds || []), JSON.stringify(r.optionIds || []),
      JSON.stringify(r.optionQuantities || {}), r.startDatetime, r.endDatetime, r.guestCount ?? null, r.guestMale ?? null,
      r.guestFemale ?? null, r.guestChildren ?? null, r.customerName ?? null, r.customerEmail ?? null, r.customerTel ?? null,
      r.customerAddress ?? null, r.note ?? null, r.status || "pending_review", r.totalPrice ?? null, iso(r.createdAt),
      r.paymentStatus || "none", r.payjpChargeId ?? null, r.paymentAmount ?? null, r.refundedAmount ?? 0,
      r.cardBrand ?? null, r.cardLast4 ?? null, r.capturedAt ?? null,
    ],
  },
  {
    name: "block_holds",
    list: (d) => d.blockHolds,
    cols: ["data"],
    key: null,
    params: (b) => [JSON.stringify(b)],
    // jsonb の等価比較（キーの順番が違っても同じものとみなす）
    whereCast: ["jsonb"],
  },
  {
    name: "price_rules",
    list: (d) => d.priceRules,
    cols: ["id", "label", "start_date", "end_date", "coefficient", "type"],
    key: ["id"],
    params: (pr) => [pr.id, pr.label, pr.startDate, pr.endDate, pr.coefficient ?? 1, pr.type || "custom"],
  },
  {
    name: "mail_log",
    list: (d) => d.mailLog,
    cols: ["id", "type", "to", "subject", "body", "status", "error", "created_at"],
    key: ["id"],
    params: (m) => [m.id, m.type, m.to, m.subject, m.body, m.status, m.error ?? null, iso(m.createdAt)],
  },
];

// 子テーブルから先に削除し、親テーブルから先に追加・更新する
const DELETE_ORDER = ["plan_resources", "plan_confirmation_rules", "plan_options", "reservations", "block_holds",
  "price_rules", "mail_log", "plans", "options", "resources"];

const COUNTER_NAMES = ["nextReservationId", "nextPriceRuleId", "nextOptionSeq", "nextMailLogId"];

function rowKey(t, params) {
  if (!t.key) return JSON.stringify(params);
  return JSON.stringify(t.key.map((k) => params[t.cols.indexOf(k)]));
}

// テーブルごとに Map(行の鍵 → 列の値の JSON)
function snapshotOf(data) {
  const snap = {};
  for (const t of TABLES) {
    const m = new Map();
    for (const row of t.list(data) || []) {
      const params = t.params(row);
      m.set(rowKey(t, params), JSON.stringify(params));
    }
    snap[t.name] = m;
  }
  snap.counters = Object.fromEntries(COUNTER_NAMES.map((n) => [n, data[n]]));
  return snap;
}

const q = (c) => `"${c}"`;

async function insertRow(client, t, params) {
  const ph = params.map((_, i) => `$${i + 1}`).join(",");
  await client.query(`INSERT INTO ${t.name} (${t.cols.map(q).join(",")}) VALUES (${ph})`, params);
}

async function updateRow(client, t, params) {
  const keyIdx = t.key.map((k) => t.cols.indexOf(k));
  const setCols = t.cols.map((c, i) => [c, i]).filter(([, i]) => !keyIdx.includes(i));
  const values = setCols.map(([, i]) => params[i]).concat(keyIdx.map((i) => params[i]));
  const set = setCols.map(([c], n) => `${q(c)} = $${n + 1}`).join(", ");
  const where = t.key.map((k, n) => `${q(k)} = $${setCols.length + n + 1}`).join(" AND ");
  // 同時に削除されていた行なら0件更新になる（その場合は何もしない）
  await client.query(`UPDATE ${t.name} SET ${set} WHERE ${where}`, values);
}

async function deleteRow(client, t, params) {
  const cols = t.key || t.cols;
  const vals = cols.map((c) => params[t.cols.indexOf(c)]);
  const where = cols
    .map((c, n) => {
      const cast = !t.key && t.whereCast ? `::${t.whereCast[n]}` : "";
      return vals[n] === null ? `${q(c)} IS NULL` : `${q(c)} = $${n + 1}${cast}`;
    })
    .join(" AND ");
  const used = vals.filter((v) => v !== null);
  // 鍵のないテーブル（全列が同じ重複行）でも1行だけ消す
  const sql = t.key
    ? `DELETE FROM ${t.name} WHERE ${renumber(where)}`
    : `DELETE FROM ${t.name} WHERE ctid IN (SELECT ctid FROM ${t.name} WHERE ${renumber(where)} LIMIT 1)`;
  await client.query(sql, used);
}

// NULL の列を除いたあとの $n を詰め直す
function renumber(where) {
  let n = 0;
  return where.replace(/\$\d+/g, () => `$${++n}`);
}

/**
 * load() で読み込んだ data を保存する（差分だけを書き込む）。
 * load() を経ていない data（初期データ投入スクリプトなど）は、全行を「追加または更新」し、何も削除しない。
 */
async function save(data, { client: outerClient } = {}) {
  const d = { ...defaultData(), ...data };
  const snap = data && data[SNAPSHOT];
  // client を渡された場合は、呼び出し側のトランザクションの中で書く（コミットは呼び出し側）
  const run = outerClient ? (fn) => fn(outerClient) : withTransaction;

  await run(async (client) => {
    const current = {};
    for (const t of TABLES) {
      const m = new Map();
      for (const row of t.list(d) || []) {
        const params = t.params(row);
        m.set(rowKey(t, params), params);
      }
      current[t.name] = m;
    }

    // 1) 呼び出し側が取り除いた行を削除（子テーブルから）
    if (snap) {
      for (const name of DELETE_ORDER) {
        const t = TABLES.find((x) => x.name === name);
        const before = snap[name];
        for (const [k, json] of before) {
          if (!current[name].has(k)) await deleteRow(client, t, JSON.parse(json));
        }
      }
    }

    // 2) 追加・更新（親テーブルから）
    for (const t of TABLES) {
      const before = snap ? snap[t.name] : null;
      for (const [k, params] of current[t.name]) {
        if (before) {
          if (!before.has(k)) await insertRow(client, t, params);
          else if (t.key && before.get(k) !== JSON.stringify(params)) await updateRow(client, t, params);
        } else if (t.key) {
          // スナップショットなし（スクリプト）：追加または更新
          const ph = params.map((_, i) => `$${i + 1}`).join(",");
          const upd = t.cols.filter((c) => !t.key.includes(c)).map((c) => `${q(c)} = EXCLUDED.${q(c)}`).join(", ");
          await client.query(
            `INSERT INTO ${t.name} (${t.cols.map(q).join(",")}) VALUES (${ph}) ON CONFLICT (${t.key.map(q).join(",")}) DO ${upd ? `UPDATE SET ${upd}` : "NOTHING"}`,
            params
          );
        } else {
          const exists = await client.query(
            `SELECT 1 FROM ${t.name} WHERE ${t.cols.map((c, n) => `${q(c)} IS NOT DISTINCT FROM $${n + 1}${t.whereCast ? `::${t.whereCast[n]}` : ""}`).join(" AND ")} LIMIT 1`,
            params
          );
          if (!exists.rows.length) await insertRow(client, t, params);
        }
      }
    }

    // 3) 採番カウンター：変わったものだけ。値は減らさない（同時実行で古い値に戻さない）
    for (const name of COUNTER_NAMES) {
      if (d[name] === undefined || d[name] === null) continue;
      if (snap && snap.counters[name] === d[name]) continue;
      await client.query(
        `INSERT INTO counters (name, value) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET value = GREATEST(counters.value, EXCLUDED.value)`,
        [name, d[name]]
      );
    }
  });
}


async function exists() {
  const res = await dbQuery("SELECT 1 FROM plans LIMIT 1");
  return res.rows.length > 0;
}

module.exports = { load, save, defaultData, exists };
