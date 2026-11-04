-- OTA予約（ota_blocks）に、来店の記録（来店済み・未来店）を持たせる列を追加する。
-- 本番DBに対しては postgres ユーザーで1回だけ実行する（再実行しても安全）。
-- 値： ''（まだ来店していない）／ 'visited'（来店済み）／ 'no_show'（未来店）
-- iCal同期でブロックが更新されても、この列は上書きされない。

ALTER TABLE ota_blocks ADD COLUMN IF NOT EXISTS visit_status TEXT NOT NULL DEFAULT '';
