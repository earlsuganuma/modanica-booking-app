import { NextResponse } from "next/server";
const { ROOMS, CHANNELS, listOtaBlocks } = require("../../../../lib/otaBlocks");
const {
  getExportTokens,
  regenerateToken,
  listFeeds,
  saveFeed,
  validateImportUrl,
  runIcalSync,
} = require("../../../../lib/icalSync");
const { todayStr } = require("../../../../lib/dateUtil");
const { syncOtaBlocks } = require("../../../../lib/googleCalendar");
const { ingestOtaMail } = require("../../../../lib/otaMail");
const { addDays } = require("../../../../lib/ical");

export const dynamic = "force-dynamic";

// 管理画面専用（/api/admin/* はログイン必須）。OTA iCal 連携の設定・状態。

function baseUrl(request) {
  const env = process.env.ADMIN_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

async function state(request) {
  const tokens = await getExportTokens({ create: true });
  const base = baseUrl(request);
  const exportUrls = CHANNELS.map((c) => ({
    channel: c.id,
    label: c.label,
    rooms: ROOMS.map((r) => ({ slug: r.slug, label: r.label, url: `${base}/ical/${tokens[c.id]}/${r.slug}.ics` })),
  }));
  let feeds = [];
  let tableReady = true;
  try {
    feeds = await listFeeds();
  } catch (e) {
    tableReady = false;
  }
  const blocks = await listOtaBlocks({ fromDate: addDays(todayStr(), -1) });
  return { rooms: ROOMS, channels: CHANNELS, exportUrls, feeds, blocks, tableReady };
}

export async function GET(request) {
  return NextResponse.json(await state(request));
}

// 取り込みURLの保存（空欄＝登録解除。その取り込み分の売り止めも消える）
export async function PUT(request) {
  const body = await request.json().catch(() => ({}));
  const { resourceId, channel } = body;
  const importUrl = String(body.importUrl || "").trim();
  if (!ROOMS.some((r) => r.resourceId === resourceId) || !CHANNELS.some((c) => c.id === channel)) {
    return NextResponse.json({ error: "invalid_target", message: "部屋またはチャネルが正しくありません。" }, { status: 400 });
  }
  if (importUrl) {
    const err = validateImportUrl(importUrl);
    if (err) return NextResponse.json({ error: "invalid_url", message: err }, { status: 400 });
  }
  try {
    await saveFeed({ resourceId, channel, importUrl });
  } catch (e) {
    console.error("saveFeed failed:", e.message);
    return NextResponse.json(
      { error: "save_failed", message: "保存に失敗しました。データベースの準備（テーブル作成）が済んでいない可能性があります。" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, ...(await state(request)) });
}

// action=sync：今すぐ取得 ／ action=regenerate：書き出しURLの再発行（旧URLは使えなくなる）
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (body.action === "sync") {
    try {
      const result = await runIcalSync({ notify: true });
      try {
        await ingestOtaMail();
      } catch (e) {
        console.error("otaMail (admin) failed:", e);
      }
      await syncOtaBlocks();
      return NextResponse.json({ ok: true, result, ...(await state(request)) });
    } catch (e) {
      console.error("ical sync (admin) failed:", e);
      return NextResponse.json({ error: "sync_failed", message: String((e && e.message) || e) }, { status: 500 });
    }
  }
  if (body.action === "regenerate") {
    if (!CHANNELS.some((c) => c.id === body.channel)) {
      return NextResponse.json({ error: "invalid_channel" }, { status: 400 });
    }
    await regenerateToken(body.channel);
    return NextResponse.json({ ok: true, ...(await state(request)) });
  }
  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
