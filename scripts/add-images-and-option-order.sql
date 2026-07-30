-- プラン画像（最大3枚）・オプションのサムネイル画像・オプションの表示順のため、カラムを追加する。
-- 本番DBに対しては1回だけ実行する（IF NOT EXISTSなので再実行しても安全）。

ALTER TABLE plans ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]';
ALTER TABLE options ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE options ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- 既存のoptionsには表示順が無い（挿入順は不定）ため、id順で初期値を採番しておく。
-- （実行後は管理画面から自由に並び替え可能）
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) - 1 AS rn
  FROM options
)
UPDATE options
SET sort_order = ordered.rn
FROM ordered
WHERE options.id = ordered.id AND options.sort_order = 0;
