import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 廃止済みエンドポイント：予約詳細の閲覧・ステータス変更は管理画面専用の
// /api/admin/reservations/[id] （ログイン必須）に移行しました。
// このパスは顧客氏名・連絡先などの個人情報を含むため、認証なしで動くGETを
// 復活させないこと。
export async function GET() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

export async function PATCH() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}
