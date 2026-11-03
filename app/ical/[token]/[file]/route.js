const { channelForToken, buildExportIcs } = require("../../../../lib/icalSync");

export const dynamic = "force-dynamic";

// OTA（Booking.com・Airbnb）向けの在庫カレンダー書き出し。
// GET /ical/{チャネル別トークン}/naka.ics ・ /ical/{トークン}/washitsu.ics
// トークンが一致しなければ 404（URLの存在自体を明かさない）。個人情報は含めない（SUMMARY は "Blocked" 固定）。
export async function GET(request, { params }) {
  const { token, file } = await params;
  const m = /^([a-z]+)\.ics$/.exec(file || "");
  const notFound = () => new Response("Not Found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  if (!m) return notFound();
  let channel;
  try {
    channel = await channelForToken(token);
  } catch (e) {
    console.error("ical export token lookup failed:", e.message);
    return new Response("Service Unavailable", { status: 503 });
  }
  if (!channel) return notFound();
  try {
    const ics = await buildExportIcs(m[1], channel);
    if (!ics) return notFound();
    return new Response(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="${m[1]}.ics"`,
        "Cache-Control": "no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (e) {
    // 失敗時に空のカレンダーを返すと OTA 側で全日程が空いてしまうため、必ずエラーで返す
    console.error("ical export failed:", e);
    return new Response("Service Unavailable", { status: 503 });
  }
}
