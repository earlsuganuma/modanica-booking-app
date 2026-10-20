-- 私用・予約不可の日時（private_blocks）テーブルを追加する。
-- 本番DBに対しては postgres ユーザーで1回だけ実行する（再実行しても安全）。
-- アプリ用ロール(modanica)には CREATE 権限がないため、テーブル作成と権限付与をここで行う。

CREATE TABLE IF NOT EXISTS private_blocks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  start_datetime TEXT NOT NULL,
  end_datetime TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 対象プラン（カンマ区切りのプランID。空＝全プラン）
ALTER TABLE private_blocks ADD COLUMN IF NOT EXISTS plan_ids TEXT NOT NULL DEFAULT '';

GRANT SELECT, INSERT, UPDATE, DELETE ON private_blocks TO modanica;
GRANT USAGE, SELECT ON SEQUENCE private_blocks_id_seq TO modanica;
