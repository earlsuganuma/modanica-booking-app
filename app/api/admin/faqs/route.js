import { NextResponse } from "next/server";
const { CATEGORIES, listFaqs, replaceFaqs } = require("../../../../lib/faqs");

export const dynamic = "force-dynamic";

const MAX_ITEMS = 50;
const MAX_QUESTION = 200;
const MAX_ANSWER = 2000;

// 管理画面専用（/api/admin/* はmiddleware.jsによりログイン必須）。
export async function GET(request) {
  const category = new URL(request.url).searchParams.get("category");
  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "invalid_category" }, { status: 400 });
  }
  return NextResponse.json({ faqs: await listFaqs(category) });
}

// カテゴリ内のQ&A一覧を丸ごと置き換える（追加・編集・削除・並び替えをまとめて保存）。
export async function PUT(request) {
  const body = await request.json();
  const { category, items } = body;
  if (!CATEGORIES.includes(category) || !Array.isArray(items)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (items.length > MAX_ITEMS) {
    return NextResponse.json({ error: "too_many", message: `Q&Aは最大${MAX_ITEMS}件までです。` }, { status: 400 });
  }
  const cleaned = [];
  for (const it of items) {
    const question = String((it && it.question) || "").trim();
    const answer = String((it && it.answer) || "").trim();
    if (!question && !answer) continue; // 空行は無視
    if (!question || !answer) {
      return NextResponse.json({ error: "incomplete", message: "質問と回答は両方入力してください。" }, { status: 400 });
    }
    if (question.length > MAX_QUESTION || answer.length > MAX_ANSWER) {
      return NextResponse.json(
        { error: "too_long", message: `質問は${MAX_QUESTION}文字、回答は${MAX_ANSWER}文字までです。` },
        { status: 400 }
      );
    }
    cleaned.push({ question, answer });
  }
  await replaceFaqs(category, cleaned);
  return NextResponse.json({ ok: true, count: cleaned.length });
}
