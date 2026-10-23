-- 入金予定の概算機能のためのDB変更。本番DBに対して postgres ユーザーで1回だけ実行する（再実行しても安全）。
-- 1) reservations に「決済確定日時」の列を追加 2) 手数料率などの設定を保存する app_settings テーブルを追加

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON app_settings TO modanica;
