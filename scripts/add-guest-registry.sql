-- 宿泊者名簿フォーム（/checkin）の入力内容を保存するテーブル。OTA（Booking.com・Airbnb）のお客様向け。
-- 本番DBに対しては postgres ユーザーで1回だけ実行する（再実行しても安全）。
--
-- ota_block_id：紐づいたOTA予約（ota_blocks.id）。紐づけ待ちのときは NULL。
--   外部キーにしていないのは、OTA側のキャンセルで ota_blocks の行が消えても、名簿の記録を残すため。
-- link_status：'linked'（OTA予約に紐づいた）／ 'pending'（紐づけ待ち。管理画面で選んで紐づける）

CREATE TABLE IF NOT EXISTS guest_registry (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_in TEXT NOT NULL CHECK (check_in ~ '^\d{4}-\d{2}-\d{2}$'),
  guest_name TEXT NOT NULL,
  address TEXT NOT NULL,
  tel TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  guest_male INTEGER NOT NULL DEFAULT 0,
  guest_female INTEGER NOT NULL DEFAULT 0,
  guest_children INTEGER NOT NULL DEFAULT 0,
  arrival_time TEXT NOT NULL DEFAULT '',
  nationality TEXT NOT NULL DEFAULT '',
  passport_no TEXT NOT NULL DEFAULT '',
  booking_ref TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  ota_block_id INTEGER,
  link_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_guest_registry_check_in ON guest_registry (check_in);
CREATE INDEX IF NOT EXISTS idx_guest_registry_block ON guest_registry (ota_block_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON guest_registry TO modanica;
GRANT USAGE, SELECT ON SEQUENCE guest_registry_id_seq TO modanica;
