-- よくある質問（Q&A）テーブルを追加する。施設利用(facility)・カフェ(cafe)のカテゴリごとに管理する。
-- 本番DBに対しては postgres ユーザーで1回だけ実行する（再実行しても安全）。
-- アプリ用ロール(modanica)には ALTER/CREATE 権限がないため、テーブル作成と権限付与をここで行う。

CREATE TABLE IF NOT EXISTS faqs (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE, DELETE ON faqs TO modanica;
GRANT USAGE, SELECT ON SEQUENCE faqs_id_seq TO modanica;

-- 仮のサンプル（管理画面「Q&A管理」から編集・削除できます）。テーブルが空のときだけ投入する。
INSERT INTO faqs (category, question, answer, sort_order)
SELECT * FROM (VALUES
  ('facility', 'チェックイン・チェックアウトの時間は？', 'プランによって異なります。各プラン詳細ページの説明をご確認ください（例：IN 16:00／OUT 翌11:00）。', 1),
  ('facility', 'お子様の宿泊料金は？', '中部屋のみ利用・簡易部屋のみ利用プランでは、お子様（4〜12歳）は宿泊料金の70%です。予約フォームの「子供」欄に人数をご入力ください。', 2),
  ('facility', '予約確定までの流れは？', 'お申し込み後は「要確認」ステータスとなり、担当者が確認のうえ確定のご連絡をいたします。クレジットカードは送信時には与信枠の確保のみで、確定時にお支払いが確定します。', 3),
  ('facility', '宿泊時に必要な情報は？', '旅館業法に基づく宿泊者名簿の作成のため、代表者様のお名前・ご住所・連絡先と、宿泊人数（男性・女性・子供）をご入力いただきます。', 4),
  ('cafe', '予約の流れを教えてください。', 'ご希望の日付と開始時刻、人数を入力してお申し込みください。お申し込み後は「要確認」ステータスとなり、担当者が確認のうえ確定のご連絡をいたします。', 1),
  ('cafe', 'ご利用時間はどれくらいですか？', 'プランごとに目安の利用時間が決まっています（通常カフェ利用は2時間、飲み会・ディナーコース等は4時間）。終了時刻は開始時刻から自動で設定されます。営業時間は11:00〜22:00です。', 2),
  ('cafe', '予約後に日程の変更をお願いされることはありますか？', '宿泊・施設貸切のご予約が優先的に確定した場合、日程の変更をお願いすることがあります。その際は遅くともご利用日の2営業日前までにご連絡し、次回ご利用いただける割引クーポンをご用意します。', 3)
) AS v(category, question, answer, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM faqs);
