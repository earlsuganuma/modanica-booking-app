-- PAY.JP決済連携のため、reservationsテーブルに決済関連カラムを追加する。
-- 本番DBに対しては1回だけ実行する（IF NOT EXISTSなので再実行しても安全）。

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payjp_charge_id TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_amount INTEGER;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS refunded_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS card_brand TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS card_last4 TEXT;
