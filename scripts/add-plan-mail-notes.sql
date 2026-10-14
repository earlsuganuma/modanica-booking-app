-- プランごとの確定メール追記文テーブルを追加する。
-- 本番DBに対しては postgres ユーザーで1回だけ実行する（再実行しても安全）。
-- アプリ用ロール(modanica)には CREATE 権限がないため、テーブル作成と権限付与をここで行う。

CREATE TABLE IF NOT EXISTS plan_mail_notes (
  plan_id TEXT PRIMARY KEY,
  confirmed_note TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON plan_mail_notes TO modanica;
