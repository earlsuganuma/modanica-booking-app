import { NextResponse } from "next/server";
const { COOKIE_NAME, verifySessionToken, isConfigured } = require("./lib/adminAuth");

// 管理画面（/admin と /api/admin 配下）を専用のログインページで保護します。
// ログイン情報は環境変数 ADMIN_BASIC_AUTH_USER / ADMIN_BASIC_AUTH_PASSWORD で設定します。
// .env.local に設定してください（.env.local.example を参照）。
//
// Next.js 16でファイル名・エクスポート名が middleware → proxy に変更されたのに伴い改名。
// proxyはNode.jsランタイムで動作する（旧middlewareのEdgeランタイムとは異なる）が、
// lib/adminAuth.js はWeb標準のcrypto.subtle/btoaのみで実装しているため、そのままNode.js上でも動作する。

const PUBLIC_ADMIN_PATHS = ["/admin/login"];
const PUBLIC_API_PATHS = ["/api/admin/login"];

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/admin");

  if (PUBLIC_ADMIN_PATHS.includes(pathname) || PUBLIC_API_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  if (!isConfigured()) {
    const message =
      "管理画面のログイン情報（ADMIN_BASIC_AUTH_USER / ADMIN_BASIC_AUTH_PASSWORD）が設定されていません。.env.local を設定してサーバーを再起動してください。";
    if (isApi) {
      return NextResponse.json({ ok: false, error: message }, { status: 503 });
    }
    return new NextResponse(message, { status: 503 });
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const valid = await verifySessionToken(token);

  if (valid) {
    return NextResponse.next();
  }

  if (isApi) {
    return NextResponse.json({ ok: false, error: "ログインが必要です。" }, { status: 401 });
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
