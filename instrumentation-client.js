// クライアント（ブラウザ）側のエラー監視設定。
// Next.js App Routerの現行の規約に従い、instrumentation-client.js を
// プロジェクトルートに置くと自動的に読み込まれる（sentry.client.config.js は旧方式）。
// DSNは公開情報（秘密鍵ではない）なのでソースに直書きして問題ありません。
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://50ae2716f6aeb1c3aefa86939e05558d@o4511822364672000.ingest.us.sentry.io/4511822413758464",

  // パフォーマンストレースのサンプリング率（コスト抑制のため低めに設定）
  tracesSampleRate: 0.2,

  // 本番環境でのみ有効化（開発中のノイズを避ける）
  enabled: process.env.NODE_ENV === "production",

  debug: false,
});

// ページ遷移（クライアントサイドナビゲーション）もトレース対象にする
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
