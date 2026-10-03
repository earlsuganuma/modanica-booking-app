-- 新プラン「女子会貸切宿泊プラン」(p10) を追加する。
-- 飲み会＋宿泊貸切(p2)と同じ範囲（中部屋・小部屋・カフェ全体）・同じ時間帯タイプ(IN18:00/OUT翌11:00)の貸切プラン。
-- 本番DBに対しては1回だけ実行する（IDが重複する場合は何もしないので再実行しても安全）。

INSERT INTO plans (
  id, code, category, name, exclusivity, time_type,
  min_guests, max_guests, base_price, description,
  booking_open_days_before, final_booking_deadline_days_before,
  slot_prices, sort_order, images, guest_prices
) VALUES (
  'p10', 10, 'facility', '女子会貸切宿泊プラン', 'full_house', 'stay_18_11',
  1, 7, 58000, 'IN 18:00 / OUT 翌11:00。カフェ全体・中部屋・小部屋を貸切。女子会・パーティーでのご利用におすすめです。',
  NULL, 3,
  NULL, 10, '[]', NULL
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO plan_resources (plan_id, resource_id)
SELECT 'p10', r.id FROM (VALUES ('room_a'), ('room_b'), ('cafe')) AS r(id)
ON CONFLICT DO NOTHING;

INSERT INTO plan_confirmation_rules (plan_id, day_type, confirmation_type)
SELECT 'p10', 'all', 'manual'
WHERE NOT EXISTS (
  SELECT 1 FROM plan_confirmation_rules WHERE plan_id = 'p10' AND day_type = 'all'
);
