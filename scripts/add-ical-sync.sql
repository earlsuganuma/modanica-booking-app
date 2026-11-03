-- OTA（Booking.com・Airbnb）との iCal 在庫同期用のテーブルを追加する。
-- 本番DBに対しては postgres ユーザーで1回だけ実行する（再実行しても安全）。
-- アプリ用ロール(modanica)には CREATE 権限がないため、テーブル作成と権限付与をここで行う。
-- 書き出しURLのトークンは app_settings（ical.export_token.<チャネル>）に保存する（テーブル追加なし）。

-- 取り込みURL（部屋×チャネルごとに1件）
CREATE TABLE IF NOT EXISTS ical_feeds (
  id SERIAL PRIMARY KEY,
  -- resources への外部キーは付けない。store.save() が resources を消して入れ直す方式だった頃、
  -- ON DELETE CASCADE で取り込みURLまで連鎖して消えたため（2026-11-02）。部屋IDの妥当性はアプリ側（lib/otaBlocks.js の ROOMS）で確認する。
  resource_id TEXT NOT NULL,
  channel TEXT NOT NULL,              -- 'booking' | 'airbnb'
  import_url TEXT NOT NULL,
  last_fetched_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_status TEXT,                   -- 'ok' | 'fetch_error' | 'parse_error'
  last_error TEXT,
  last_event_count INTEGER,
  fail_count INTEGER NOT NULL DEFAULT 0,
  fail_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (resource_id, channel)
);

-- 取り込んだ OTA の予約・ブロック（UID ごと）。start_date＝チェックイン日、end_date＝チェックアウト日（含まない）。
CREATE TABLE IF NOT EXISTS ota_blocks (
  id SERIAL PRIMARY KEY,
  feed_id INTEGER NOT NULL REFERENCES ical_feeds(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  uid TEXT NOT NULL,
  start_date TEXT NOT NULL CHECK (start_date ~ '^\d{4}-\d{2}-\d{2}$'),
  end_date TEXT NOT NULL CHECK (end_date ~ '^\d{4}-\d{2}-\d{2}$'),
  summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (feed_id, uid)
);
CREATE INDEX IF NOT EXISTS idx_ota_blocks_resource_dates ON ota_blocks(resource_id, end_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON ical_feeds, ota_blocks TO modanica;
GRANT USAGE, SELECT ON SEQUENCE ical_feeds_id_seq, ota_blocks_id_seq TO modanica;
