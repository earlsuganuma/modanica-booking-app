import { NextResponse } from "next/server";
const path = require("path");
const fs = require("fs/promises");

export const dynamic = "force-dynamic";

// 管理画面からの画像アップロード（プラン画像・オプションサムネイル用）。
// uploads/{kind}/{id}/ 配下（publicフォルダの外）にファイルを保存し、
// 配信は専用のAPIルート（/api/uploads/[...path]）経由で行う。
//
// 【注意】当初はpublic/uploads配下に保存しURLも/uploads/...としていたが、
// Next.js（next start）はpublicフォルダの静的配信について起動時点の状態をキャッシュしており、
// 起動後にAPI経由で追加したファイルが404になり続ける不具合が本番で確認されたため、
// publicフォルダ配信には頼らず、リクエストの都度ディスクから読み込んで返す方式に変更した。
//
// このディレクトリ（uploads/）はデプロイ時のrsyncで除外設定（.github/workflows/deploy.yml）されており、
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
  const dir = path.join(process.cwd(), "uploads", kind, id);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await fs.writeFile(path.join(dir, filename), buffer);

  const url = `/api/uploads/${kind}/${id}/${filename}`;
  return NextResponse.json({ url });
}

// アップロード済み画像の削除（プランのimages配列・オプションのimageUrlから外した際に呼び出す）。
export async function DELETE(request) {
  const { url } = await request.json();
  if (typeof url !== "string" || !url.startsWith("/api/uploads/") || url.includes("..")) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }
  const relative = url.slice("/api/uploads/".length);
  const filePath = path.join(process.cwd(), "uploads", relative);
  try {
    await fs.unlink(filePath);
  } catch (e) {
    // ファイルが既に無くてもエラーにはしない
  }
  return NextResponse.json({ ok: true });
}
