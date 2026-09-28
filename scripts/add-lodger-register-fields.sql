-- 宿泊者名簿（旅館業法対応）用：人数内訳（男・女・子供）と住所のカラムを追加する。
-- 本番DBに対しては1回だけ実行する（IF NOT EXISTSなので再実行しても安全）。

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guest_male INTEGER;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guest_female INTEGER;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guest_children INTEGER;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS customer_address TEXT;
