// Q&Aの回答など、管理者が入力したテキストを安全なHTMLに変換する。
// 使えるタグは <a href="http(s)://...">, <br>, <strong>, <b>, <em>, <i> のみ。
// それ以外のタグ・属性・スクリプトはすべて文字として無害化（エスケープ）する。
// また、本文中の http(s):// で始まるURLは自動でリンクにする。

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SIMPLE_TAGS = ["strong", "b", "em", "i"];
const TAG_RE = /(<\/?(?:a|br|strong|b|em|i)\b[^<>]*>)/i;
const URL_RE = /https?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/g;

function linkifyText(escaped) {
  return escaped.replace(URL_RE, (match) => {
    // 末尾の句読点・閉じ括弧はリンクに含めない
    const m = match.match(/^(.*?)([.,;:!?)]*)$/);
    const url = m[1];
    const trail = m[2];
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="underline text-blue-700">${url}</a>${trail}`;
  });
}

function extractHref(tag) {
  const m = tag.match(/href\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  if (!m) return null;
  const raw = (m[1] ?? m[2] ?? "").trim();
  // 許可するのは http(s) / mailto / tel のみ（javascript: 等は拒否）
  if (!/^(https?:\/\/|mailto:|tel:)/i.test(raw)) return null;
  return raw;
}

function toSafeHtml(input) {
  const text = String(input || "");
  const parts = text.split(TAG_RE);
  const stack = []; // 開いているタグ（閉じ忘れを最後に補う）
  let insideLink = false;
  let out = "";

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    // split() でキャプチャグループを使っているため、奇数番目が「許可タグ候補」、偶数番目が通常のテキスト。
    if (i % 2 === 0) {
      const escaped = escapeHtml(part);
      out += insideLink ? escaped : linkifyText(escaped);
      continue;
    }
    const tagMatch = part.match(/^<(\/?)([a-z]+)\b/i);
    const closing = tagMatch[1] === "/";
    const name = tagMatch[2].toLowerCase();

    if (name === "br") {
      if (!closing) out += "<br>";
      continue;
    }
    if (closing) {
      const idx = stack.lastIndexOf(name);
      if (idx === -1) continue; // 対応する開始タグがない閉じタグは無視
      while (stack.length > idx) {
        const t = stack.pop();
        out += `</${t}>`;
        if (t === "a") insideLink = false;
      }
      continue;
    }
    if (name === "a") {
      const href = extractHref(part);
      if (!href || insideLink) {
        continue; // 不正なhref・入れ子リンクは無視（中身のテキストは残る）
      }
      out += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="underline text-blue-700">`;
      stack.push("a");
      insideLink = true;
      continue;
    }
    if (SIMPLE_TAGS.includes(name)) {
      out += `<${name}>`;
      stack.push(name);
    }
  }

  while (stack.length) out += `</${stack.pop()}>`;
  return out;
}

module.exports = { toSafeHtml };
