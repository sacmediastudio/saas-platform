import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth";
import { getOrderStats, type OrderPeriod } from "@/lib/order-analytics";

const VALID_PERIODS: OrderPeriod[] = ["day", "week", "month", "year"];

// GET /api/tenant/order-stats?period=week
export async function GET(req: NextRequest) {
  const session = await requireTenant();

  const periodParam = req.nextUrl.searchParams.get("period");
  const period: OrderPeriod = VALID_PERIODS.includes(periodParam as OrderPeriod)
    ? (periodParam as OrderPeriod)
    : "week";

  const stats = await getOrderStats(session.tenantId, period);
  return NextResponse.json(stats);
}
