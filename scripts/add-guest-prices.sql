-- 部屋のみ貸すプラン（4名部屋のみ利用・簡易部屋のみ利用）向けの、人数ごとの1泊料金カラムを追加する。
-- 本番DBに対しては1回だけ実行する（IF NOT EXISTSなので再実行しても安全）。

ALTER TABLE plans ADD COLUMN IF NOT EXISTS guest_prices JSONB;
