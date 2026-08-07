import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  await requireAdmin();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalTenants,
    byType,
    newLast7Days,
    newLast30Days,
    suspendedCount,
    subscriptionsByStatus,
  ] = await Promise.all([
    db.tenant.count(),
    db.tenant.groupBy({ by: ["businessType"], _count: true }),
    db.tenant.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.tenant.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.tenant.count({ where: { suspended: true } }),
    db.subscription.groupBy({ by: ["status"], _count: true }),
  ]);

  return NextResponse.json({
    totalTenants,
    byType: Object.fromEntries(byType.map((b) => [b.businessType, b._count])),
    newLast7Days,
    newLast30Days,
    suspendedCount,
    subscriptionsByStatus: Object.fromEntries(subscriptionsByStatus.map((s) => [s.status, s._count])),
  });
}
