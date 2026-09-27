import { NextResponse } from "next/server";
import { sessionCookieName, clearedSessionCookieOptions } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookieName, "", clearedSessionCookieOptions());
  return res;
}
