import { NextResponse } from "next/server";
const path = require("path");
const fs = require("fs/promises");

export const dynamic = "force-dynamic";

// 管理画面からの画像アップロード（プラン画像・オプションサムネイル用）。
// public/uploads/{kind}/{id}/ 配下にファイルを保存し、公開URL（/uploads/...）を返す。
// このディレクトリはデプロイ時のrsyncで除外設定（.github/workflows/deploy.yml）されており、
// 再デプロイ時に削除されないようになっている。

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const VALID_KINDS = ["plans", "options"];

function sanitizeId(id) {
  return String(id || "").replace(/[^a-zA-Z0-9_-]/g, "");
}

export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const kind = formData.get("kind");
  const id = sanitizeId(formData.get("id"));

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }
  if (!VALID_KINDS.includes(kind)) {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }
  if (!id) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }
  const ext = ALLOWED_EXTENSIONS[file.type];
  if (!ext) {
    return NextResponse.json({ error: "unsupported_file_type", message: "JPEG・PNG・WebP形式の画像のみアップロードできます。" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "file_too_large", message: "画像サイズは5MB以下にしてください。" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "public", "uploads", kind, id);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await fs.writeFile(path.join(dir, filename), buffer);

  const url = `/uploads/${kind}/${id}/${filename}`;
  return NextResponse.json({ url });
}

// アップロード済み画像の削除（プランのimages配列・オプションのimageUrlから外した際に呼び出す）。
export async function DELETE(request) {
  const { url } = await request.json();
  if (typeof url !== "string" || !url.startsWith("/uploads/")) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }
  const filePath = path.join(process.cwd(), "public", url);
  try {
    await fs.unlink(filePath);
  } catch (e) {
    // ファイルが既に無くてもエラーにはしない
  }
  return NextResponse.json({ ok: true });
}
