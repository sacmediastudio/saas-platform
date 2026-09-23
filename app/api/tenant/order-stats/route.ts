import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth";
import { getOrderStats, type OrderPeriod, type CustomRange } from "@/lib/order-analytics";

const VALID_PERIODS: OrderPeriod[] = ["day", "week", "month", "year", "custom"];
const MAX_RANGE_DAYS = 366;

// "YYYY-MM-DD" (lo que manda <input type="date">) se interpreta acá como
// medianoche LOCAL del servidor — no medianoche UTC, que es lo que hace
// `new Date("2026-09-23")` por norma ISO 8601. Si se mezclara ese parseo
// UTC con el resto de esta librería (que arma todos sus baldes en hora
// local, como "day"/"week"/"month"), un pedido de "hoy" podía quedar
// afuera del balde de "hoy" por el corrimiento de huso horario.
function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

// GET /api/tenant/order-stats?period=week
// GET /api/tenant/order-stats?period=custom&start=2026-09-01&end=2026-09-15
export async function GET(req: NextRequest) {
  const session = await requireTenant();

  const periodParam = req.nextUrl.searchParams.get("period");
  const period: OrderPeriod = VALID_PERIODS.includes(periodParam as OrderPeriod)
    ? (periodParam as OrderPeriod)
    : "week";

  let customRange: CustomRange | undefined;
  if (period === "custom") {
    const start = parseLocalDate(req.nextUrl.searchParams.get("start") ?? "");
    const end = parseLocalDate(req.nextUrl.searchParams.get("end") ?? "");
    if (!start || !end || start > end) {
      return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
    }
    const rangeDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (rangeDays > MAX_RANGE_DAYS) {
      return NextResponse.json({ error: `El rango máximo es de ${MAX_RANGE_DAYS} días` }, { status: 400 });
    }
    customRange = { start, end };
  }

  const stats = await getOrderStats(session.tenantId, period, customRange);
  return NextResponse.json(stats);
}
