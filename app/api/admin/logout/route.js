import { NextResponse } from "next/server";
const { COOKIE_NAME } = require("../../../../lib/adminAuth");

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
