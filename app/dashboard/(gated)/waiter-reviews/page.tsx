import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEnabledModules } from "@/lib/modules";
import { getWaiterReviewSettings } from "@/lib/waiter-reviews";
import WaiterReviewsView from "./waiter-reviews-view";

export default async function WaiterReviewsPage() {
  const session = await requirePagePermission("REVIEWS");
  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } });
  if (!tenant || !getEnabledModules(tenant).includes("RESTAURANT")) redirect("/dashboard");

  const since = new Date(Date.now() - 30 * 86_400_000);
  const [settings, hours, waiters, allStats, recentStats, recent] = await Promise.all([
    getWaiterReviewSettings(tenant.id),
    db.businessHours.findMany({ where: { tenantId: tenant.id }, orderBy: { dayOfWeek: "asc" } }),
    db.serviceWaiter.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    db.serviceReview.groupBy({
      by: ["waiterId"],
      where: { tenantId: tenant.id },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    db.serviceReview.groupBy({
      by: ["waiterId"],
      where: { tenantId: tenant.id, createdAt: { gte: since } },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    db.serviceReview.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { waiter: { select: { name: true } } },
    }),
  ]);

  const all = new Map(allStats.map((s) => [s.waiterId, s]));
  const last30 = new Map(recentStats.map((s) => [s.waiterId, s]));

  return (
    <WaiterReviewsView
      initialSettings={settings}
      hours={hours.map((h) => ({ dayOfWeek: h.dayOfWeek, isOpen: h.isOpen, startTime: h.startTime, endTime: h.endTime }))}
      initialWaiters={waiters.map((w) => ({
        id: w.id,
        name: w.name,
        photoUrl: w.photoUrl,
        isActive: w.isActive,
        avg: all.get(w.id)?._avg.rating ?? null,
        count: all.get(w.id)?._count._all ?? 0,
        avg30: last30.get(w.id)?._avg.rating ?? null,
        count30: last30.get(w.id)?._count._all ?? 0,
      }))}
      recentReviews={recent.map((r) => ({
        id: r.id,
        waiterName: r.waiter.name,
        rating: r.rating,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
      }))}
      timezone={tenant.timezone}
    />
  );
}
