import { NextResponse } from "next/server";
const path = require("path");
const fs = require("fs/promises");

export const dynamic = "force-dynamic";

// アップロード済み画像（プラン画像・オプションサムネイル）の配信用エンドポイント。
// 実体はpublicフォルダの外（プロジェクトルート直下のuploads/）に保存されており、
// このルートがリクエストの都度ディスクから読み込んで返す。
//
// 【なぜpublicフォルダに置いて直接配信しないのか】
// next start は public フォルダの静的配信について起動時点の状態をキャッシュしており、
// 起動後（＝アプリ稼働中）にAPI経由で追加したファイルを配信しようとすると404が返り続ける
// 不具合が本番で確認されたため、この方式に変更した。

const CONTENT_TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(request, { params }) {
  const { path: segments } = await params;
  if (!Array.isArray(segments) || segments.length === 0 || segments.some((s) => s.includes(".."))) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const ext = (segments[segments.length - 1].split(".").pop() || "").toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const filePath = path.join(process.cwd(), "uploads", ...segments);
  try {
    const buffer = await fs.readFile(filePath);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    return new NextResponse("Not Found", { status: 404 });
  }
}
