// 予約フォームの入力内容（ドラフト）を暗号化したトークンにして、決済後の戻りURLに持たせる。
// PayPayアプリ／別ブラウザから戻ってきても予約を完了できるようにするため（sessionStorageに頼らない）。
// AES-256-GCM（鍵は PAYJP_SECRET_KEY から導出）。改ざん・偽造されたトークンは復号に失敗する。
// 有効期限（既定2時間）を過ぎたトークンは無効。

const crypto = require("crypto");

function keyBytes() {
  const secret = process.env.DRAFT_TOKEN_SECRET || process.env.PAYJP_SECRET_KEY || "";
  if (!secret) throw new Error("DRAFT_TOKEN_SECRET / PAYJP_SECRET_KEY が未設定です");
  return crypto.createHash("sha256").update(`modanica-draft:${secret}`).digest();
}

function seal(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBytes(), iv);
  const json = JSON.stringify({ ...payload, exp: Date.now() + 2 * 60 * 60 * 1000 });
  const enc = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

// 復号に失敗・期限切れの場合は null。
function open(token) {
  try {
    const buf = Buffer.from(String(token), "base64url");
    if (buf.length < 29) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", keyBytes(), iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
    const payload = JSON.parse(json);
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

module.exports = { seal, open };
