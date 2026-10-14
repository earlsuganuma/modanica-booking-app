import { NextResponse } from "next/server";
const { listPlans } = require("../../../../lib/plans");
const { listConfirmedNotes, saveConfirmedNote } = require("../../../../lib/planMailNotes");

export const dynamic = "force-dynamic";

const MAX_NOTE = 2000;

// 管理画面専用（/api/admin/* はログイン必須）。プランごとの確定メール追記文の取得・保存。
export async function GET() {
  const [plans, notes] = await Promise.all([listPlans(), listConfirmedNotes()]);
  return NextResponse.json({
    plans: plans.map((p) => ({ id: p.id, name: p.name, note: notes[p.id] || "" })),
  });
}

export async function PUT(request) {
  const { planId, note } = await request.json();
  const plans = await listPlans();
  if (!plans.some((p) => p.id === planId)) {
    return NextResponse.json({ error: "plan_not_found" }, { status: 404 });
  }
  const text = String(note || "").trim();
  if (text.length > MAX_NOTE) {
    return NextResponse.json({ error: "too_long", message: `追記文は${MAX_NOTE}文字までです。` }, { status: 400 });
  }
  try {
    await saveConfirmedNote(planId, text);
  } catch (e) {
    console.error("saveConfirmedNote failed:", e.message);
    return NextResponse.json(
      { error: "save_failed", message: "保存に失敗しました。データベースの準備（テーブル作成）が済んでいない可能性があります。" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
