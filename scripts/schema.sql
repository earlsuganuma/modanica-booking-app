-- MODANICA 予約管理システム DBスキーマ（PostgreSQL）
-- 既存の data.json（lib/store.js）の構造をそのままテーブル化したもの。

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  capacity INTEGER,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  code INTEGER,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  exclusivity TEXT NOT NULL,
  time_type TEXT NOT NULL,
  min_guests INTEGER,
  max_guests INTEGER,
  base_price INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  booking_open_days_before INTEGER,
  final_booking_deadline_days_before INTEGER,
  slot_prices JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plan_resources (
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, resource_id)
);

CREATE TABLE IF NOT EXISTS plan_confirmation_rules (
  id SERIAL PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  day_type TEXT NOT NULL,
  confirmation_type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS options (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'flag',
  max_quantity INTEGER,
  unit_label TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS plan_options (
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  option_id TEXT NOT NULL REFERENCES options(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (plan_id, option_id)
);

CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  resource_ids JSONB NOT NULL DEFAULT '[]',
  option_ids JSONB NOT NULL DEFAULT '[]',
  option_quantities JSONB NOT NULL DEFAULT '{}',
  -- start_datetime/end_datetime はタイムゾーンなしの壁時計時刻（resolveDatetime()が
  -- 生成する "YYYY-MM-DDTHH:MM" をそのまま保存する）。TIMESTAMP（tzなし）にすると
  -- Node.js側（pgドライバ）がサーバのシステムタイムゾーンで解釈してしまい9時間ずれる
  -- 事故が起きたため、TIMESTAMPTZ（UTCとして保存・解釈）のままにしている。
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  guest_count INTEGER,
  customer_name TEXT,
  customer_email TEXT,
  customer_tel TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review',
  total_price INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- PAY.JP決済関連（オーソリ＋確定方式。詳細は lib/payjpClient.js のコメントを参照）。
  -- payment_status: none（決済なし・PAY.JP未設定時）/ authorized（与信確保済み・未確定）/
  --   captured（支払い確定済み）/ released（与信解放・未確定のままキャンセル）/
  --   refunded（全額返金）/ partially_refunded（一部返金）/ failed（オーソリ失敗）
  payment_status TEXT NOT NULL DEFAULT 'none',
  payjp_charge_id TEXT,
  payment_amount INTEGER,
  refunded_amount INTEGER NOT NULL DEFAULT 0,
  card_brand TEXT,
  card_last4 TEXT
);

CREATE TABLE IF NOT EXISTS block_holds (
  id SERIAL PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS price_rules (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  coefficient NUMERIC NOT NULL DEFAULT 1,
  type TEXT NOT NULL DEFAULT 'custom'
);

CREATE TABLE IF NOT EXISTS mail_log (
  id INTEGER PRIMARY KEY,
  type TEXT,
  "to" TEXT,
  subject TEXT,
  body TEXT,
  status TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 採番カウンター（nextReservationId 等）を1行で保持する
CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

INSERT INTO counters (name, value) VALUES
  ('nextReservationId', 1),
  ('nextPriceRuleId', 1),
  ('nextOptionSeq', 1),
  ('nextMailLogId', 1)
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_reservations_plan_id ON reservations(plan_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_start ON reservations(start_datetime);
CREATE INDEX IF NOT EXISTS idx_price_rules_dates ON price_rules(start_date, end_date);
