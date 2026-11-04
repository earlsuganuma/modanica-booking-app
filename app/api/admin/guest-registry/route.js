import { NextResponse } from "next/server";
const { listPending, linkEntry, unlinkEntry, deleteEntry, totalGuests } = require("../../../../lib/guestRegistry");
const { listOtaBlocks, ROOMS, channelLabel } = require("../../../../lib/otaBlocks");
const { syncOtaBlocks } = require("../../../../lib/googleCalendar");
const { todayStr } = require("../../../../lib/dateUtil");
const { addDays } = require("../../../../lib/ical");

export const dynamic = "force-dynamic";

// 管理画面専用（/api/admin/* はログイン必須）。紐づけ待ちの名簿の一覧と、OTA予約への手動の紐づけ。

// GET：紐づけ待ちの名簿と、それぞれの候補（同じチェックイン日のOTA予約）
export async function GET() {
  const pending = await listPending();
  const blocks = await listOtaBlocks({ fromDate: addDays(todayStr(), -30) });
  const list = pending.map((e) => ({
    id: e.id,
    created_at: e.createdAt,
    check_in: e.checkIn,
    guest_name: e.guestName,
    address: e.address,
    tel: e.tel,
    guest_male: e.guestMale,
    guest_female: e.guestFemale,
    guest_children: e.guestChildren,
    total_guests: totalGuests(e),
    arrival_time: e.arrivalTime,
    booking_ref: e.bookingRef,
    candidates: blocks
      .filter((b) => b.startDate === e.checkIn)
      .map((b) => {
        const room = ROOMS.find((r) => r.resourceId === b.resourceId);
        return {
          id: b.id,
          label: `${channelLabel(b.channel)} ${room ? room.label : b.resourceId}（${b.startDate}〜${b.endDate}）${
            b.guestName ? ` ${b.guestName}` : ""
          }${b.guestCount != null ? ` ${b.guestCount}名` : ""}`,
        };
      }),
  }));
  return NextResponse.json({ pending: list });
}

// PATCH：{ id, blockId } 紐づける ／ { id, action: "unlink" } 紐づけを外す ／ { id, action: "delete" } 名簿を削除
export async function PATCH(request) {
  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  try {
    if (body.action === "delete") {
      await deleteEntry(id);
    } else if (body.action === "unlink") {
      await unlinkEntry(id);
    } else {
      const blockId = Number(body.blockId);
      if (!blockId) return NextResponse.json({ error: "block_required" }, { status: 400 });
      const r = await linkEntry(id, blockId);
      if (!r) return NextResponse.json({ error: "not_found", message: "名簿またはOTA予約が見つかりません。" }, { status: 404 });
      try {
        await syncOtaBlocks();
      } catch (e) {
        console.error("guest-registry link: calendar sync failed:", e.message);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin guest-registry failed:", e.message);
    return NextResponse.json({ error: "failed", message: "処理に失敗しました。" }, { status: 500 });
  }
}
