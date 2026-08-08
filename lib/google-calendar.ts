import { db } from "./db";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI);
}

export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID ?? "",
    redirect_uri: REDIRECT_URI ?? "",
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",
    // "consent" fuerza a que Google mande refresh_token siempre, incluso
    // si el negocio ya había autorizado antes — sin esto, en una
    // reconexión Google a veces no lo reenvía.
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID ?? "",
      client_secret: CLIENT_SECRET ?? "",
      redirect_uri: REDIRECT_URI ?? "",
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`No se pudo intercambiar el código de Google por tokens: ${body}`);
  }
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID ?? "",
      client_secret: CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`No se pudo refrescar el token de Google: ${body}`);
  }
  return res.json();
}

/**
 * Devuelve un access token válido para el negocio, refrescándolo primero
 * si ya expiró (o está por expirar en el próximo minuto). Devuelve null
 * si el negocio nunca conectó Google Calendar.
 */
async function getValidAccessToken(tenantId: string): Promise<string | null> {
  const conn = await db.googleCalendarConnection.findUnique({ where: { tenantId } });
  if (!conn) return null;

  if (conn.expiresAt.getTime() > Date.now() + 60_000) {
    return conn.accessToken;
  }

  const refreshed = await refreshAccessToken(conn.refreshToken);
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
  await db.googleCalendarConnection.update({
    where: { tenantId },
    data: { accessToken: refreshed.access_token, expiresAt },
  });
  return refreshed.access_token;
}

/**
 * Crea el evento en Google Calendar para una cita confirmada, y guarda
 * su id en la reserva. Si el negocio no tiene Google conectado, o si
 * algo falla, no lanza — la cita en Zertoo nunca debe fallar por culpa
 * de la sincronización externa.
 */
export async function syncBookingToGoogleCalendar(params: {
  tenantId: string;
  bookingId: string;
  serviceName: string;
  customerName: string;
  customerEmail: string;
  datetime: Date;
  durationMinutes: number;
}) {
  try {
    const accessToken = await getValidAccessToken(params.tenantId);
    if (!accessToken) return;

    const end = new Date(params.datetime.getTime() + params.durationMinutes * 60_000);

    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: `${params.serviceName} — ${params.customerName}`,
        description: `Reservado por ${params.customerName} (${params.customerEmail}) a través de Zertoo.`,
        start: { dateTime: params.datetime.toISOString() },
        end: { dateTime: end.toISOString() },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Error creando evento en Google Calendar:", res.status, body);
      return;
    }

    const event = await res.json();
    await db.booking.update({ where: { id: params.bookingId }, data: { googleEventId: event.id } });
  } catch (err) {
    console.error("No se pudo sincronizar la cita con Google Calendar:", err);
  }
}

/** Borra el evento correspondiente cuando una cita se cancela. */
export async function deleteGoogleCalendarEvent(tenantId: string, googleEventId: string) {
  try {
    const accessToken = await getValidAccessToken(tenantId);
    if (!accessToken) return;
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    console.error("No se pudo borrar el evento de Google Calendar:", err);
  }
}
