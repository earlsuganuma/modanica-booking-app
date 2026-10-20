import { NextResponse } from "next/server";
const { listBlocks, createBlock, deleteBlock } = require("../../../../lib/privateBlocks");
const { listPlans } = require("../../../../lib/plans");

export const dynamic = "force-dynamic";

// 管理画面専用（/api/admin/* はログイン必須）。私用・予約不可の日時の一覧・登録・削除。
const DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export async function GET() {
  return NextResponse.json({ blocks: await listBlocks() });
}

export async function POST(request) {
  const body = await request.json();
  const title = String(body.title || "").trim();
  const note = String(body.note || "").trim();
  const { startDatetime, endDatetime } = body;
  if (!title) return NextResponse.json({ error: "title_required", message: "タイトルを入力してください。" }, { status: 400 });
  if (title.length > 100 || note.length > 1000) {
    return NextResponse.json({ error: "too_long", message: "タイトルは100文字、メモは1000文字までです。" }, { status: 400 });
  }
  if (!DT.test(startDatetime || "") || !DT.test(endDatetime || "")) {
    return NextResponse.json({ error: "invalid_datetime", message: "日時の形式が正しくありません。" }, { status: 400 });
  }
  if (endDatetime <= startDatetime) {
    return NextResponse.json({ error: "invalid_range", message: "終了は開始より後の日時にしてください。" }, { status: 400 });
  }
  // 対象プラン（空＝全プラン）。存在するプランIDだけを受け付ける。
  const plans = await listPlans();
  const validIds = new Set(plans.map((pl) => pl.id));
  const planIds = Array.isArray(body.planIds) ? body.planIds.filter((id) => validIds.has(id)) : [];
  if (Array.isArray(body.planIds) && body.planIds.length && !planIds.length) {
    return NextResponse.json({ error: "invalid_plans", message: "対象プランが正しくありません。" }, { status: 400 });
  }
  try {
    const block = await createBlock({ title, note, startDatetime, endDatetime, planIds });
    return NextResponse.json({ ok: true, block });
  } catch (e) {
    console.error("createBlock failed:", e.message);
    return NextResponse.json(
      { error: "save_failed", message: "保存に失敗しました。データベースの準備（テーブル作成）が済んでいない可能性があります。" },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  try {
    await deleteBlock(id);
  } catch (e) {
    console.error("deleteBlock failed:", e.message);
    return NextResponse.json({ error: "delete_failed", message: "削除に失敗しました。" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
