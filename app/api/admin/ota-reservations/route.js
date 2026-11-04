import { NextResponse } from "next/server";
const { ROOMS, CHANNELS, listOtaBlocks, updateOtaBlockDetails, setOtaVisitStatus, channelLabel } = require("../../../../lib/otaBlocks");
const { syncOtaBlocks } = require("../../../../lib/googleCalendar");
const { todayStr } = require("../../../../lib/dateUtil");
const { addDays } = require("../../../../lib/ical");

export const dynamic = "force-dynamic";

// 管理画面専用（/api/admin/* はログイン必須）。iCalで取り込んだOTA予約の一覧と、詳細（お客様名・人数・金額・メモ）の保存。
// iCalには日付と部屋しか入っていないため、詳細は手入力で補う。

export async function GET() {
  // 過去60日分から先を返す
  const blocks = await listOtaBlocks({ fromDate: addDays(todayStr(), -60) });
  const list = blocks.map((b) => {
    const room = ROOMS.find((r) => r.resourceId === b.resourceId);
    return {
      id: b.id,
      channel: b.channel,
      channel_label: channelLabel(b.channel),
      resource_id: b.resourceId,
      room_label: room ? room.label : b.resourceId,
      start_date: b.startDate,
      end_date: b.endDate,
      nights: Math.round((Date.parse(b.endDate) - Date.parse(b.startDate)) / 86400000),
      summary: b.summary,
      guest_name: b.guestName,
      guest_count: b.guestCount,
      total_price: b.totalPrice,
      memo: b.memo,
      booking_ref: b.bookingRef,
      visit_status: b.visitStatus,
      created_at: b.createdAt,
    };
  });
  return NextResponse.json({ channels: CHANNELS, reservations: list });
}

export async function PATCH(request) {
  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  // 来店記録だけの更新（来店済み／未来店／元に戻す）
  if (body.action === "visit_status") {
    try {
      const row = await setOtaVisitStatus(id, body.visitStatus);
      if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error("setOtaVisitStatus failed:", e.message);
      return NextResponse.json(
        { error: "save_failed", message: "保存に失敗しました。データベースの準備（visit_status 列の追加）が済んでいない可能性があります。" },
        { status: 500 }
      );
    }
  }
  let updated;
  try {
    updated = await updateOtaBlockDetails(id, body);
  } catch (e) {
    console.error("updateOtaBlockDetails failed:", e.message);
    return NextResponse.json(
      { error: "save_failed", message: "保存に失敗しました。データベースの準備（列の追加）が済んでいない可能性があります。" },
      { status: 500 }
    );
  }
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await syncOtaBlocks(); // Googleカレンダーの予定にも反映
  return NextResponse.json({ ok: true });
}
