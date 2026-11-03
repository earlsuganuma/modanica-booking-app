-- OTA予約（ota_blocks）に、お客様名・人数・金額・メモを持たせる列を追加する。
-- 本番DBに対しては postgres ユーザーで1回だけ実行する（再実行しても安全）。
-- iCalには日付と部屋しか入っていないため、これらは管理画面からの手入力（または今後のメール取り込み）で補う。
-- 同期でブロックが更新されても、これらの列は上書きされない（日付と summary だけを更新する）。

ALTER TABLE ota_blocks ADD COLUMN IF NOT EXISTS guest_name TEXT NOT NULL DEFAULT '';
ALTER TABLE ota_blocks ADD COLUMN IF NOT EXISTS guest_count INTEGER;
ALTER TABLE ota_blocks ADD COLUMN IF NOT EXISTS total_price INTEGER;
ALTER TABLE ota_blocks ADD COLUMN IF NOT EXISTS memo TEXT NOT NULL DEFAULT '';
-- OTAの予約番号（メール取り込みで、どの泊の予約かを結びつけるときに使う。今は未使用）
ALTER TABLE ota_blocks ADD COLUMN IF NOT EXISTS booking_ref TEXT NOT NULL DEFAULT '';
