// 簡易レート制限（不正ログイン対策・不正利用対策の一環）。
// MODANICAはゲスト予約のみ（会員登録・ログインなし）のため、PAY.JPの「不正ログイン対策」
// 申告項目に対応する実質的な対策として、決済に関わるAPI（カード試行を伴うもの）への
// 呼び出しをIPアドレス単位・メールアドレス単位で短時間に制限する。
// サーバープロセスのメモリ内で管理する単純な実装（単一プロセス運用が前提。
// pm2 cluster等で複数プロセス化する場合は共有ストア（Redis等）への置き換えが必要）。

const WINDOW_MS = 10 * 60 * 1000; // 10分
const MAX_ATTEMPTS_PER_IP = 10;
const MAX_ATTEMPTS_PER_EMAIL = 5;

const attemptsByIp = new Map();
const attemptsByEmail = new Map();

function prune(map, key, now) {
  const list = (map.get(key) || []).filter((t) => now - t < WINDOW_MS);
  map.set(key, list);
  return list;
}

function getClientIp(request) {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

// 制限に達している場合はNextResponse相当のエラーオブジェクト（呼び出し側でそのままreturnできる形）、
// 問題なければnullを返す。呼び出し成功時は試行回数をカウントアップする。
function checkRateLimit(request, email) {
  const { NextResponse } = require("next/server");
  const now = Date.now();
  const ip = getClientIp(request);

  const ipAttempts = prune(attemptsByIp, ip, now);
  if (ipAttempts.length >= MAX_ATTEMPTS_PER_IP) {
    return NextResponse.json(
      { error: "rate_limited", message: "短時間に決済の試行が多すぎます。しばらく時間をおいてから再度お試しください。" },
      { status: 429 }
    );
  }

  const normalizedEmail = (email || "").trim().toLowerCase();
  if (normalizedEmail) {
    const emailAttempts = prune(attemptsByEmail, normalizedEmail, now);
    if (emailAttempts.length >= MAX_ATTEMPTS_PER_EMAIL) {
      return NextResponse.json(
        { error: "rate_limited", message: "短時間に決済の試行が多すぎます。しばらく時間をおいてから再度お試しください。" },
        { status: 429 }
      );
    }
    emailAttempts.push(now);
    attemptsByEmail.set(normalizedEmail, emailAttempts);
  }

  ipAttempts.push(now);
  attemptsByIp.set(ip, ipAttempts);
  return null;
}

module.exports = { checkRateLimit };
