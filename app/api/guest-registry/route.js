import { NextResponse } from "next/server";
const { createEntry, rateLimited } = require("../../../lib/guestRegistry");
const { syncOtaBlocks } = require("../../../lib/googleCalendar");
const { normalizeTel } = require("../../../lib/repeater");
const { todayStr } = require("../../../lib/dateUtil");
const { addDays } = require("../../../lib/ical");

export const dynamic = "force-dynamic";

// 宿泊者名簿フォーム（/checkin）の送信先。ログイン不要の公開API（OTAのお客様が入力する）。
// 入力内容を保存し、OTA予約に紐づけられるものは自動で紐づける。保存した内容は、この応答には含めない。

function clientIp(request) {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
const count = (v) => Math.min(30, Math.max(0, Math.floor(Number(v) || 0)));

export async function POST(request) {
  if (rateLimited(clientIp(request))) {
    return NextResponse.json(
      { error: "rate_limited", message: "短時間に送信が多すぎます。しばらく時間をおいてから、もう一度お試しください。" },
      { status: 429 }
    );
  }
  const body = await request.json().catch(() => ({}));

  // ボット対策のおとり欄（人間には見えない）。入力があれば、成功したように見せて、保存しない。
  if (str(body.website, 100)) return NextResponse.json({ ok: true });

  const input = {
    checkIn: str(body.checkIn, 10),
    guestName: str(body.guestName, 100),
    address: str(body.address, 300),
    tel: str(body.tel, 40),
    email: str(body.email, 200),
    guestMale: count(body.guestMale),
    guestFemale: count(body.guestFemale),
    guestChildren: count(body.guestChildren),
    arrivalTime: str(body.arrivalTime, 40),
    nationality: str(body.nationality, 60),
    passportNo: str(body.passportNo, 60),
    bookingRef: str(body.bookingRef, 20).replace(/\D/g, ""),
    note: str(body.note, 500),
  };

  const fail = (message) => NextResponse.json({ error: "invalid", message }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.checkIn)) return fail("チェックイン日を入力してください。 / Please enter your check-in date.");
  if (input.checkIn < addDays(todayStr(), -7) || input.checkIn > addDays(todayStr(), 400)) {
    return fail("チェックイン日をご確認ください。 / Please check your check-in date.");
  }
  if (!input.guestName) return fail("お名前を入力してください。 / Please enter your name.");
  if (!input.address) return fail("ご住所を入力してください。 / Please enter your address.");
  if (!normalizeTel(input.tel)) return fail("電話番号を入力してください。 / Please enter a valid phone number.");
  if (input.guestMale + input.guestFemale + input.guestChildren < 1) {
    return fail("人数を入力してください。 / Please enter the number of guests.");
  }
  if (body.agree !== true) return fail("個人情報の取り扱いへの同意が必要です。 / Please agree to the handling of personal information.");
  const foreign = input.nationality && !/^日本|japan$/i.test(input.nationality);
  if (foreign && !input.passportNo) return fail("日本国内に住所のない外国の方は、パスポート番号が必要です。 / Passport number is required for foreign guests.");

  try {
    const result = await createEntry(input);
    if (result.linked) {
      try {
        await syncOtaBlocks(); // Googleカレンダーのお客様名にも反映（未設定なら何もしない）
      } catch (e) {
        console.error("guest-registry: calendar sync failed:", e.message);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("guest-registry: save failed:", e.message);
    return NextResponse.json(
      { error: "save_failed", message: "送信に失敗しました。お手数ですが、スタッフにお声がけください。 / Failed to submit. Please tell our staff." },
      { status: 500 }
    );
  }
}
