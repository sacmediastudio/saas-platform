import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";
import { exchangeCodeForTokens, getAppBaseUrl } from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  const session = await requireTenant();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = req.cookies.get("google_oauth_state")?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL("/dashboard/bookings?google=error", getAppBaseUrl()));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Solo para mostrar "conectado como tu@correo.com" en el dashboard —
    // no es necesario para que la sincronización funcione.
    let email: string | null = null;
    try {
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (userInfoRes.ok) {
        const info = await userInfoRes.json();
        email = info.email ?? null;
      }
    } catch {
      // no crítico, seguimos sin el email
    }

    await db.googleCalendarConnection.upsert({
      where: { tenantId: session.tenantId },
      update: {
        accessToken: tokens.access_token,
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        expiresAt,
        connectedEmail: email,
      },
      create: {
        tenantId: session.tenantId,
        accessToken: tokens.access_token,
        // Si por algún motivo Google no manda refresh_token (raro con
        // prompt=consent), guardamos string vacío en vez de romper —
        // simplemente esa conexión no podrá refrescarse sola más
        // adelante y el negocio tendría que reconectar.
        refreshToken: tokens.refresh_token ?? "",
        expiresAt,
        connectedEmail: email,
      },
    });

    const res = NextResponse.redirect(new URL("/dashboard/bookings?google=connected", getAppBaseUrl()));
    res.cookies.set("google_oauth_state", "", { maxAge: 0, path: "/" });
    return res;
  } catch (err) {
    console.error("Error en el callback de Google Calendar:", err);
    return NextResponse.redirect(new URL("/dashboard/bookings?google=error", getAppBaseUrl()));
  }
}
