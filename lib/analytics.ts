import { db } from "./db";

export type PageViewKind = "MENU" | "BOOK" | "LINK";

// Se llama desde cada página pública en cada visita. No lanza si falla —
// una analítica caída nunca debe romper la página que el cliente está
// viendo.
export async function recordPageView(tenantId: string, kind: PageViewKind) {
  try {
    await db.pageView.create({ data: { tenantId, kind } });
  } catch (err) {
    console.error("No se pudo registrar la vista de página:", err);
  }
}

export async function getViewsLast7Days(tenantId: string, kind: PageViewKind): Promise<number> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return db.pageView.count({ where: { tenantId, kind, createdAt: { gte: since } } });
}

export async function getTotalViews(tenantId: string, kind: PageViewKind): Promise<number> {
  return db.pageView.count({ where: { tenantId, kind } });
}

/**
 * Compara las vistas de los últimos 7 días contra los 7 días previos,
 * para poder mostrar "↑ 24% esta semana" en vez de solo un número
 * suelto sin contexto.
 */
export async function getViewsTrend(
  tenantId: string,
  kind: PageViewKind
): Promise<{ current: number; previous: number; changePercent: number | null }> {
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const [current, previous] = await Promise.all([
    db.pageView.count({ where: { tenantId, kind, createdAt: { gte: new Date(now - sevenDays) } } }),
    db.pageView.count({
      where: { tenantId, kind, createdAt: { gte: new Date(now - 2 * sevenDays), lt: new Date(now - sevenDays) } },
    }),
  ]);
  const changePercent = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
  return { current, previous, changePercent };
}
