/**
 * Todo lo relacionado a fechas en el módulo de Citas necesita saber en
 * qué zona horaria está el negocio — nunca asumir la del servidor
 * (Railway corre en UTC), ni la del navegador de quien esté mirando
 * (el dueño y el cliente final pueden estar en zonas distintas). Estas
 * funciones usan la API `Intl` nativa de JS (sin librerías externas)
 * para convertir correctamente sin importar dónde corra el código.
 */

// Lista curada de zonas horarias soportadas en el selector de Ajustes.
// Vive acá (no en el route.ts de la API) porque este archivo es seguro
// de importar tanto desde el cliente (el formulario) como del servidor
// (la validación), sin arrastrar código de base de datos al navegador.
export const TIMEZONES = [
  "America/Aruba",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/Sao_Paulo",
  "Europe/Madrid",
  "Europe/London",
  "UTC",
] as const;

/** Offset de una zona horaria respecto a UTC, en minutos, en un instante dado. */
function getTimezoneOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;

  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return (asUTC - date.getTime()) / 60_000;
}

/** Día de la semana (0=domingo...6=sábado) de un instante, en una zona horaria dada. */
export function getDayOfWeekInTz(date: Date, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? date.getUTCDay();
}

/** Minutos desde medianoche de un instante, en una zona horaria dada. */
export function getMinutesOfDayInTz(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;
  return Number(parts.hour) * 60 + Number(parts.minute);
}

/**
 * Dado un día en formato "YYYY-MM-DD" que representa un día calendario
 * EN la zona horaria del negocio, devuelve el rango de instantes UTC
 * reales que cubre ese día completo (medianoche a medianoche, en esa
 * zona horaria) — lo que hay que usar para filtrar citas "de ese día"
 * en la base de datos, sin importar en qué zona horaria corra el
 * servidor.
 */
export function getDayBoundsInTz(dateLabel: string, timeZone: string): { start: Date; end: Date } {
  const [y, m, d] = dateLabel.split("-").map(Number);
  const utcGuess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const offsetMinutes = getTimezoneOffsetMinutes(utcGuess, timeZone);
  const start = new Date(utcGuess.getTime() - offsetMinutes * 60_000);
  const end = new Date(start.getTime() + 24 * 60 * 60_000 - 1);
  return { start, end };
}

/** El día calendario ("YYYY-MM-DD") en que cae un instante, en una zona horaria dada. */
export function getDateLabelInTz(date: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  return dtf.format(date); // en-CA da formato YYYY-MM-DD directo
}
