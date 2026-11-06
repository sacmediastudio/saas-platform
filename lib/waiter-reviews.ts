import { createHash } from "crypto";
import { db } from "./db";
import { getDayOfWeekInTz, getMinutesOfDayInTz } from "./timezone";
import { isGeocodingConfigured } from "./geocoding";

// Reseñas de meseros: reglas de "dónde y cuándo" se puede calificar.
// Todo se valida en el servidor — el navegador solo manda sus
// coordenadas; nunca decide si está permitido.

import {
  WAITER_REVIEW_COOLDOWN_HOURS,
  WAITER_REVIEW_GRACE_MAX,
  WAITER_REVIEW_RADIUS_MAX,
  WAITER_REVIEW_RADIUS_MIN,
  WAITER_NOTE_MAX,
  type WaiterReviewSettings,
} from "./waiter-reviews-shared";

export {
  WAITER_REVIEW_COOLDOWN_HOURS,
  WAITER_REVIEW_GRACE_MAX,
  WAITER_REVIEW_RADIUS_MAX,
  WAITER_REVIEW_RADIUS_MIN,
  WAITER_NOTE_MAX,
};

// Si el teléfono reporta una precisión peor que esto (ej. ubicación
// aproximada por WiFi/IP), no se puede confiar en ella.
const MAX_ACCEPTED_ACCURACY_M = 200;
// Cuánto de la imprecisión del GPS se le perdona al cliente: un GPS
// bajo techo suele errar 20-50 m, pero no queremos que una precisión de
// 150 m deje pasar a alguien a 250 m.
const MAX_ACCURACY_CREDIT_M = 50;

export interface DayHoursLike {
  dayOfWeek: number;
  isOpen: boolean;
  startTime: string;
  endTime: string;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * ¿Se puede calificar ahora? Verdadero si el local está abierto, o
 * cerró hace menos de `graceMinutes`. Soporta horarios que cruzan la
 * medianoche (ej. bar abierto de 18:00 a 02:00): si el cierre es igual
 * o anterior a la apertura, se entiende que cierra al día siguiente.
 */
export function isWithinReviewWindow(
  hours: DayHoursLike[],
  timezone: string,
  now: Date,
  graceMinutes: number
): boolean {
  const today = getDayOfWeekInTz(now, timezone);
  const yesterday = (today + 6) % 7;
  const nowMin = getMinutesOfDayInTz(now, timezone);

  // Ventanas posibles, en minutos relativos al inicio del día de hoy:
  // el turno que empezó hoy y el que empezó ayer (y pudo cruzar medianoche).
  const candidates: { start: number; end: number }[] = [];
  for (const [dow, offset] of [
    [today, 0],
    [yesterday, -1440],
  ] as const) {
    const row = hours.find((h) => h.dayOfWeek === dow);
    if (!row || !row.isOpen) continue;
    const start = toMinutes(row.startTime);
    let end = toMinutes(row.endTime);
    if (end <= start) end += 1440;
    candidates.push({ start: start + offset, end: end + offset });
  }

  return candidates.some((c) => nowMin >= c.start && nowMin <= c.end + graceMinutes);
}

/** Distancia entre dos coordenadas, en metros (fórmula de haversine). */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export type PresenceFailure = "disabled" | "closed" | "too_far" | "imprecise" | "no_location";

export type PresenceResult =
  | { ok: true; distanceM: number; tenantId: string }
  | { ok: false; reason: PresenceFailure };

export interface ClientLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

/**
 * Verifica todo lo que exige una reseña: función activa, local abierto
 * (con margen) y cliente dentro del radio del pin del negocio o de
 * alguno de sus locales activos con pin propio.
 */
export async function verifyReviewPresence(
  slug: string,
  loc: ClientLocation | null,
  now = new Date()
): Promise<PresenceResult> {
  const tenant = await db.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      suspended: true,
      timezone: true,
      latitude: true,
      longitude: true,
      waiterReviewsEnabled: true,
      waiterReviewRadiusM: true,
      waiterReviewGraceMinutes: true,
      locations: { where: { isActive: true }, select: { latitude: true, longitude: true } },
    },
  });

  if (!tenant || tenant.suspended || !tenant.waiterReviewsEnabled) return { ok: false, reason: "disabled" };

  const pins: { lat: number; lng: number }[] = [];
  if (tenant.latitude !== null && tenant.longitude !== null) pins.push({ lat: tenant.latitude, lng: tenant.longitude });
  for (const l of tenant.locations) {
    if (l.latitude !== null && l.longitude !== null) pins.push({ lat: l.latitude, lng: l.longitude });
  }
  if (pins.length === 0) return { ok: false, reason: "disabled" };

  // Sin horario configurado no se asume uno por defecto: si el negocio
  // nunca lo cargó, el botón no debería abrirse ni cerrarse "por azar".
  const hours = await db.businessHours.findMany({ where: { tenantId: tenant.id } });
  if (hours.length === 0) return { ok: false, reason: "closed" };
  if (!isWithinReviewWindow(hours, tenant.timezone, now, tenant.waiterReviewGraceMinutes)) {
    return { ok: false, reason: "closed" };
  }

  if (!loc) return { ok: false, reason: "no_location" };
  if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return { ok: false, reason: "no_location" };
  if (!(loc.accuracy >= 0) || loc.accuracy > MAX_ACCEPTED_ACCURACY_M) return { ok: false, reason: "imprecise" };

  const distanceM = Math.min(...pins.map((p) => distanceMeters(loc.lat, loc.lng, p.lat, p.lng)));
  const allowed = tenant.waiterReviewRadiusM + Math.min(loc.accuracy, MAX_ACCURACY_CREDIT_M);
  if (distanceM > allowed) return { ok: false, reason: "too_far" };

  return { ok: true, distanceM: Math.round(distanceM), tenantId: tenant.id };
}

/**
 * Solo la parte de horario, para decidir en el render del menú si se
 * muestra el botón "Calificar" (la ubicación se pide recién al tocarlo).
 */
export async function isReviewWindowOpen(
  tenant: { id: string; timezone: string; waiterReviewGraceMinutes: number },
  now = new Date()
): Promise<boolean> {
  const hours = await db.businessHours.findMany({ where: { tenantId: tenant.id } });
  if (hours.length === 0) return false;
  return isWithinReviewWindow(hours, tenant.timezone, now, tenant.waiterReviewGraceMinutes);
}

/** Hash del id anónimo del dispositivo, ligado al negocio. Nunca se guarda el id crudo. */
export function hashDeviceId(tenantId: string, deviceId: string): string {
  return createHash("sha256").update(`${tenantId}:${deviceId}`).digest("hex");
}

/** Estado de la configuración de reseñas de meseros de un negocio, para el dashboard. */
export async function getWaiterReviewSettings(tenantId: string): Promise<WaiterReviewSettings> {
  const [tenant, hoursCount] = await Promise.all([
    db.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        address: true,
        latitude: true,
        longitude: true,
        waiterReviewsEnabled: true,
        waiterReviewRadiusM: true,
        waiterReviewGraceMinutes: true,
      },
    }),
    db.businessHours.count({ where: { tenantId } }),
  ]);
  return {
    enabled: tenant.waiterReviewsEnabled,
    radiusM: tenant.waiterReviewRadiusM,
    graceMinutes: tenant.waiterReviewGraceMinutes,
    latitude: tenant.latitude,
    longitude: tenant.longitude,
    hasAddress: Boolean(tenant.address),
    geocodingAvailable: isGeocodingConfigured(),
    hasHours: hoursCount > 0,
  };
}

