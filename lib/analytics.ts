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
