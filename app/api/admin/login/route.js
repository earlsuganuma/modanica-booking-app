import { NextResponse } from "next/server";
const {
  COOKIE_NAME,
  SESSION_TTL_MS,
  createSessionToken,
  checkLoginCredentials,
  isConfigured,
  getLoginLockoutStatus,
  recordFailedLogin,
  resetLoginAttempts,
} = require("../../../../lib/adminAuth");

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { ok: false, error: "管理画面のログイン情報が設定されていません（ADMIN_BASIC_AUTH_USER / ADMIN_BASIC_AUTH_PASSWORD）。" },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ ok: false, error: "リクエストが不正です。" }, { status: 400 });
  }

  const { user, password } = body || {};

  // アカウントロック機能：一定回数ログインに失敗したユーザー名は、
  // 正しいパスワードが送られてきても一時的にログインを拒否する。
  const lockout = getLoginLockoutStatus(user);
  if (lockout.locked) {
    const minutes = Math.max(1, Math.ceil(lockout.retryAfterMs / 60000));
    return NextResponse.json(
      {
        ok: false,
        error: `ログイン試行回数が上限に達したため、アカウントを一時的にロックしています。${minutes}分後に再度お試しください。`,
      },
      { status: 429 }
    );
  }

  if (!checkLoginCredentials(user, password)) {
    recordFailedLogin(user);
    return NextResponse.json({ ok: false, error: "ユーザー名またはパスワードが違います。" }, { status: 401 });
  }

  resetLoginAttempts(user);
  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
