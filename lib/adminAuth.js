// 管理画面のログインセッション管理。
// middleware.js（Edge環境）とAPIルート（Node環境）の両方から呼べるように、
// Buffer等のNode専用APIは使わず、Web標準のcrypto.subtle / btoa / atob だけで実装している。

const COOKIE_NAME = "modanica_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7日間ログイン状態を保持

function getSecret() {
  // 専用のセッション署名鍵。未設定の場合は管理パスワードから代用する（推奨はしない簡易フォールバック）。
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_BASIC_AUTH_PASSWORD || "";
}

function getCredentials() {
  return {
    user: process.env.ADMIN_BASIC_AUTH_USER || "",
    password: process.env.ADMIN_BASIC_AUTH_PASSWORD || "",
  };
}

function bufferToBase64Url(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSign(value, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return bufferToBase64Url(sigBuf);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function createSessionToken() {
  const secret = getSecret();
  const expiry = Date.now() + SESSION_TTL_MS;
  const payload = String(expiry);
  const sig = await hmacSign(payload, secret);
  return `${payload}.${sig}`;
}

async function verifySessionToken(token) {
  if (!token) return false;
  const secret = getSecret();
  if (!secret) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = await hmacSign(payload, secret);
  if (!timingSafeEqual(expected, sig)) return false;
  const expiry = Number(payload);
  if (!expiry || Number.isNaN(expiry) || Date.now() > expiry) return false;
  return true;
}

function checkLoginCredentials(user, password) {
  const creds = getCredentials();
  if (!creds.user || !creds.password) return false;
  if (typeof user !== "string" || typeof password !== "string") return false;
  return timingSafeEqual(user, creds.user) && timingSafeEqual(password, creds.password);
}

module.exports = {
  COOKIE_NAME,
  SESSION_TTL_MS,
  createSessionToken,
  verifySessionToken,
  checkLoginCredentials,
  isConfigured: () => {
    const creds = getCredentials();
    return !!(creds.user && creds.password);
  },
};
