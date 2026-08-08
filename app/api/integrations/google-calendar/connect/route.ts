import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth";
import { getGoogleAuthUrl, isGoogleCalendarConfigured } from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  const session = await requireTenant();

  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(new URL("/dashboard/bookings?google=not_configured", req.url));
  }

  // El "state" es un valor aleatorio que guardamos en una cookie propia
  // y verificamos al volver del callback — evita que alguien más arme
  // un link de callback falso y conecte su propio Google a tu negocio.
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(getGoogleAuthUrl(state));
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
