const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = withSentryConfig(nextConfig, {
  org: "earlclub",
  project: "modanica-booking",

  // ビルドログを静かに（Sentryのアップロード関連ログを抑制）
  silent: true,

  // ソースマップをSentryにアップロードしてスタックトレースを見やすくする。
  // SENTRY_AUTH_TOKENが未設定の場合はアップロードをスキップするだけで、
  // ビルド自体は失敗しない。
  widenClientFileUpload: true,

  // ソースマップをブラウザに公開しない
  hideSourceMaps: true,
});
