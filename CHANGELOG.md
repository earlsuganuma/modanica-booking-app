# 変更履歴（MODANICA予約システム）

運用ルール（バージョン管理）
- 唯一の正（Single Source of Truth）は GitHub の `main`。VPSのファイルを直接編集・追加しない（次のデプロイで消えます）。
- 作業の開始前に必ず最新を取得する（`git pull`）。別のタスク・別のMacで作業した内容は、必ずGitHubへ push してから次の作業を始める。
- 機能追加ごとにコミットし、この履歴に1行追記する。リリース時は `git tag vX.Y.Z` を付けて push する。
- デプロイ前に VPS のアプリが `~/backups/` に自動保存される（直近10世代）。

## [Unreleased]
- OTA予約を、予約一覧に読み取り専用の行として表示（「OTA予約」フィルタ付き）。お客様名・人数・金額・メモを手入力で補える（ota_blocks に列を追加：scripts/add-ota-details.sql）
- OTA予約を、Googleカレンダー（MODANICA予約）にも反映（変更分だけ更新、OTA側で消えたら予定も削除）
- Booking.comの通知メール（booking@modanica.net、さくらのIMAP・読み取り専用）から、予約番号・ゲスト名・ゲストからのメッセージを、OTA予約へ自動で入力（空欄のみ埋める。手入力は上書きしない）。要 npm パッケージ imapflow・mailparser と、環境変数 OTA_MAIL_IMAP_HOST / OTA_MAIL_USER / OTA_MAIL_PASSWORD。人数・金額は、通知メールに載っていないため手入力
- バックアップの保存先を ~/app-backups に変更（~/backups は権限エラーのため）

## 0.3.0 — 2026-11
- OTA連携（Booking.com・Airbnb のiCal取り込み／書き出し）：管理画面「OTA連携」、15分ごとのcron（/api/cron/ical-sync）、部屋の売り止めを空き判定に反映（lib/ical.js, icalSync.js, otaBlocks.js）
- 予約の保存を「差分方式」に変更（lib/store.js）。同時に入った予約や、OTA取り込みURL（ical_feeds）が消える不具合の修正
- 予約の空き判定と保存を、ロック付きトランザクションで実施（lib/reservationGuard.js）。二重予約の防止
- キャンセル済み予約を戻すときに、枠が埋まっていないか確認
- メール送信ログの記録を、他のテーブルに触れない方式に変更（lib/mailer.js）
- 入金予定：返金分の決済手数料を取り消す前提に修正
- デプロイ前のVPSバックアップ（~/backups）と、削除される予定ファイルの一覧表示を追加
- 【運用の教訓】OTA連携は、いったんGitHubを通さずVPSに直接置かれていたため、2026-11-04 にVPSの内容をGitHubへ取り込んだ

## 0.2.0 — 2026-10
- 画像アップロード：自動縮小とエラー表示、デプロイ設定の uploads 除外をトップ階層のみに修正（画像配信APIが届かない不具合の修正）
- メール送信ログ：新しい順・一覧表示・絞り込み
- 入金予定の概算（PAY.JP 月2回）と手数料設定
- 来店済み／未来店ステータス
- 私用・予約不可の日時（プラン指定）
- Googleカレンダー連携（サービスアカウント方式）
- 予約受付期間を利用日の90日前からに制限、特定商取引法の表記を更新
- PAY.JP API v2（カード・PayPay）本番稼働

## 0.1.0
- 初期版（予約・管理画面・PAY.JP v1 決済・メール通知）
