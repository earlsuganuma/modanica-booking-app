-- 2026-11-02 の取り込みURL消失の再発防止。
-- ical_feeds.resource_id → resources(id) の外部キー（ON DELETE CASCADE）を外す。
-- store.save()（旧方式）が resources を DELETE するたびに、連鎖して ical_feeds とその ota_blocks が消えていた。
-- 本番DBに対しては postgres ユーザーで1回だけ実行する（再実行しても安全）。行のデータには触れない。
ALTER TABLE ical_feeds DROP CONSTRAINT IF EXISTS ical_feeds_resource_id_fkey;
