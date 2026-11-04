import { NextResponse } from "next/server";
const { load } = require("../../../../../lib/store");
const { isStayPlan } = require("../../../../../lib/lodging");
const { listForCsv } = require("../../../../../lib/guestRegistry");
const { channelLabel } = require("../../../../../lib/otaBlocks");

export const dynamic = "force-dynamic";

// 宿泊者名簿（旅館業法対応）CSV出力。
// 対象：
//   ・自社の予約：宿泊を伴う4プラン（BBQ＋宿泊貸切・飲み会＋宿泊貸切・中部屋のみ利用・簡易部屋のみ利用）のみ。
//   ・OTA（Booking.com・Airbnb）のお客様：宿泊者名簿フォーム（/checkin）に入力された内容。
// 項目：滞在日程、氏名（代表者）、人数（男,女,子供）、住所、連絡先（TEL）、予約経路、国籍、旅券番号
// 管理画面専用（/api/admin/* はmiddleware.jsによりログイン必須）。

function csvEscape(value) {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatDateRange(start, end) {
  const s = start ? start.replace("T", " ") : "";
  const e = end ? end.replace("T", " ") : "";
  return `${s} 〜 ${e}`;
}

export async function GET() {
  const data = await load();
  const ownRows = data.reservations
    .filter((r) => r.status !== "cancelled")
    .filter((r) => {
      const plan = data.plans.find((p) => p.id === r.planId);
      return isStayPlan(plan);
    })
    .map((r) => ({
      sort: r.startDatetime,
      cols: [
        formatDateRange(r.startDatetime, r.endDatetime),
        r.customerName,
        r.guestMale,
        r.guestFemale,
        r.guestChildren,
        r.customerAddress,
        r.customerTel,
        "公式サイト",
        "",
        "",
      ],
    }));

  const otaRows = (await listForCsv()).map((e) => ({
    sort: `${e.checkIn}T00:00`,
    cols: [
      e.blockStart ? `${e.blockStart} 〜 ${e.blockEnd}` : `${e.checkIn} 〜（紐づけ待ち）`,
      e.guestName,
      e.guestMale,
      e.guestFemale,
      e.guestChildren,
      e.address,
      e.tel,
      e.channel ? channelLabel(e.channel) : "OTA",
      e.nationality && !/^日本$/.test(e.nationality) ? e.nationality : "",
      e.passportNo,
    ],
  }));

  const rows = [...ownRows, ...otaRows].sort((a, b) => String(a.sort).localeCompare(String(b.sort)));

  const header = ["滞在日程", "氏名(代表者)", "人数(男)", "人数(女)", "人数(子供)", "住所", "連絡先(TEL)", "予約経路", "国籍(外国の方)", "旅券番号"];
  const lines = [header.map(csvEscape).join(",")];
  for (const row of rows) lines.push(row.cols.map(csvEscape).join(","));

  // Excelでの文字化け防止のためBOMを付与する。
  const csv = "\uFEFF" + lines.join("\r\n") + "\r\n";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lodger-register.csv"`,
    },
  });
}
