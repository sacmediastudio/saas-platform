import { db } from "./db";
import { getDayOfWeekInTz, getMinutesOfDayInTz, getDayBoundsInTz, getDateLabelInTz } from "./timezone";

export interface DayHours {
  dayOfWeek: number; // 0 = domingo ... 6 = sábado
  isOpen: boolean;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

const DEFAULT_HOURS: DayHours[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  dayOfWeek: d,
  isOpen: d !== 0, // cerrado los domingos por defecto, resto abierto
  startTime: "09:00",
  endTime: "18:00",
}));

/**
 * El horario configurado de un negocio, con default sensato (L-S 9-18,
 * domingo cerrado) para negocios que todavía no lo personalizaron —
 * así el módulo de citas funciona desde el primer momento sin que el
 * dueño tenga que configurar nada antes.
 */
export async function getBusinessHours(tenantId: string): Promise<DayHours[]> {
  const rows = await db.businessHours.findMany({ where: { tenantId } });
  if (rows.length === 0) return DEFAULT_HOURS;
  return DEFAULT_HOURS.map((def) => {
    const row = rows.find((r) => r.dayOfWeek === def.dayOfWeek);
    return row
      ? { dayOfWeek: row.dayOfWeek, isOpen: row.isOpen, startTime: row.startTime, endTime: row.endTime }
      : { ...def, isOpen: false }; // si nunca se guardó ese día, se asume cerrado
  });
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Un candidato de horario y un rango ocupado "chocan" si, considerando
// el buffer de ambos lados, sus rangos se superponen. Aplicar el buffer
// de forma simétrica (a ambos) es lo que garantiza el espacio libre
// entre cualquier par de citas consecutivas, sin importar cuál se haya
// agendado primero.
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number, buffer: number): boolean {
  return aStart < bEnd + buffer && aEnd + buffer > bStart;
}

const SLOT_STEP_MINUTES = 15;

/**
 * Calcula los horarios de inicio disponibles (strings "HH:MM", en la
 * zona horaria del negocio) para un servicio en una fecha dada,
 * respetando: horario de atención ese día de la semana, citas ya
 * existentes (+ buffer), bloqueos, y que no se ofrezcan horarios ya
 * pasados si la fecha es hoy. Todo el cálculo de día/hora se hace en
 * la zona horaria real del negocio (`Tenant.timezone`), nunca en la
 * del servidor.
 */
export async function getAvailableSlots(params: {
  tenantId: string;
  serviceId: string;
  dateLabel: string; // "YYYY-MM-DD", el día que el cliente eligió
}): Promise<string[]> {
  const { tenantId, serviceId, dateLabel } = params;

  const [service, tenant, hours] = await Promise.all([
    db.service.findFirst({ where: { id: serviceId, tenantId } }),
    db.tenant.findUnique({ where: { id: tenantId }, select: { bufferMinutes: true, timezone: true } }),
    getBusinessHours(tenantId),
  ]);
  if (!service || !tenant) return [];

  const tz = tenant.timezone;
  const { start: dayStart, end: dayEnd } = getDayBoundsInTz(dateLabel, tz);
  const dayOfWeek = getDayOfWeekInTz(dayStart, tz);

  const dayHours = hours.find((h) => h.dayOfWeek === dayOfWeek);
  if (!dayHours || !dayHours.isOpen) return [];

  const buffer = tenant.bufferMinutes;
  const duration = service.durationMinutes;

  const [bookings, blocks] = await Promise.all([
    db.booking.findMany({
      where: {
        tenantId,
        status: { in: ["PENDING", "CONFIRMED"] },
        datetime: { gte: dayStart, lte: dayEnd },
        ...(service.staffId ? { staffId: service.staffId } : {}),
      },
      include: { service: true },
    }),
    db.availabilityBlock.findMany({
      where: {
        tenantId,
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
        OR: [{ staffId: service.staffId ?? undefined }, { staffId: null }],
      },
    }),
  ]);

  // Todo lo "ocupado" ese día, expresado en minutos desde medianoche
  // EN LA ZONA HORARIA DEL NEGOCIO (no la del servidor).
  const busyRanges: { start: number; end: number }[] = [];
  for (const b of bookings) {
    const start = getMinutesOfDayInTz(b.datetime, tz);
    busyRanges.push({ start, end: start + b.service.durationMinutes });
  }
  for (const blk of blocks) {
    const s = blk.startTime < dayStart ? 0 : getMinutesOfDayInTz(blk.startTime, tz);
    const e = blk.endTime > dayEnd ? 24 * 60 : getMinutesOfDayInTz(blk.endTime, tz);
    busyRanges.push({ start: s, end: e });
  }

  const openStart = timeToMinutes(dayHours.startTime);
  const openEnd = timeToMinutes(dayHours.endTime);

  const now = new Date();
  const isToday = getDateLabelInTz(now, tz) === dateLabel;
  const nowMinutes = getMinutesOfDayInTz(now, tz);

  const slots: string[] = [];
  for (let start = openStart; start + duration <= openEnd; start += SLOT_STEP_MINUTES) {
    if (isToday && start <= nowMinutes) continue;
    const end = start + duration;
    const conflict = busyRanges.some((r) => overlaps(start, end, r.start, r.end, buffer));
    if (!conflict) slots.push(minutesToTime(start));
  }
  return slots;
}

/**
 * Verifica si un horario puntual está libre para un servicio — la usan
 * los endpoints que crean citas (público y manual desde el dashboard),
 * en vez de cada uno tener su propia lógica de conflictos por separado.
 */
export async function isSlotFree(params: {
  tenantId: string;
  serviceId: string;
  datetime: Date;
}): Promise<boolean> {
  const { tenantId, serviceId, datetime } = params;

  const [service, tenant] = await Promise.all([
    db.service.findFirst({ where: { id: serviceId, tenantId } }),
    db.tenant.findUnique({ where: { id: tenantId }, select: { bufferMinutes: true, timezone: true } }),
  ]);
  if (!service || !tenant) return false;

  const tz = tenant.timezone;
  const buffer = tenant.bufferMinutes;
  const duration = service.durationMinutes;

  const dateLabel = getDateLabelInTz(datetime, tz);
  const { start: dayStart, end: dayEnd } = getDayBoundsInTz(dateLabel, tz);

  const [bookings, blocks] = await Promise.all([
    db.booking.findMany({
      where: {
        tenantId,
        status: { in: ["PENDING", "CONFIRMED"] },
        datetime: { gte: dayStart, lte: dayEnd },
        ...(service.staffId ? { staffId: service.staffId } : {}),
      },
      include: { service: true },
    }),
    db.availabilityBlock.findMany({
      where: {
        tenantId,
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
        OR: [{ staffId: service.staffId ?? undefined }, { staffId: null }],
      },
    }),
  ]);

  const startMin = getMinutesOfDayInTz(datetime, tz);
  const endMin = startMin + duration;

  for (const b of bookings) {
    const bs = getMinutesOfDayInTz(b.datetime, tz);
    const be = bs + b.service.durationMinutes;
    if (overlaps(startMin, endMin, bs, be, buffer)) return false;
  }
  for (const blk of blocks) {
    const s = blk.startTime < dayStart ? 0 : getMinutesOfDayInTz(blk.startTime, tz);
    const e = blk.endTime > dayEnd ? 24 * 60 : getMinutesOfDayInTz(blk.endTime, tz);
    if (overlaps(startMin, endMin, s, e, buffer)) return false;
  }
  return true;
}
