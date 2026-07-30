// サーバー（Node.jsランタイム）側のエラー監視設定。
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://50ae2716f6aeb1c3aefa86939e05558d@o4511822364672000.ingest.us.sentry.io/4511822413758464",

  tracesSampleRate: 0.2,

  enabled: process.env.NODE_ENV === "production",

  debug: false,
});
