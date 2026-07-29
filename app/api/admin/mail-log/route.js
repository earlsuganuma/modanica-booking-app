import { NextResponse } from "next/server";
const { load } = require("../../../../lib/store");
const { isConfigured } = require("../../../../lib/mailer");

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await load();
  return NextResponse.json({ mailLog: data.mailLog || [], configured: isConfigured() });
}
