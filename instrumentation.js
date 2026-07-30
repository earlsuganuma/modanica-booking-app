// Next.js の instrumentation フック。サーバー起動時にランタイムに応じて
// sentry.server.config.js / sentry.edge.config.js を読み込む。
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config.js");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config.js");
  }
}

export async function onRequestError(...args) {
  const Sentry = await import("@sentry/nextjs");
  return Sentry.captureRequestError(...args);
}
