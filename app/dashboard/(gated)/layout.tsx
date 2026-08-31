import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureTrialEndsAt, getBillingStatus } from "@/lib/billing-status";

// Este grupo de rutas — (gated) — envuelve TODO el dashboard salvo
// /dashboard/billing (que a propósito vive afuera de esta carpeta,
// como carpeta hermana). Los paréntesis en el nombre de carpeta son
// una convención de Next.js: agrupan rutas para compartir un layout,
// sin agregar ningún segmento a la URL real — /dashboard/menu sigue
// siendo /dashboard/menu, esto es solo organización de archivos.
//
// Por qué así y no un simple `if (pathname !== "/billing")` en el
// layout de arriba: un layout compartido no tiene forma confiable de
// saber en qué sub-ruta está parado sin pasar por trucos de
// middleware. Separar "todo lo protegido" en su propia carpeta evita
// ese problema de raíz, y bloquea de verdad en el servidor — no
// depende de que el JavaScript del navegador cargue, a diferencia de
// un redirect del lado del cliente.
export default async function GatedDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [tenant, subscription] = await Promise.all([
    db.tenant.findUnique({ where: { id: session.tenantId } }),
    db.subscription.findUnique({ where: { tenantId: session.tenantId } }),
  ]);
  if (!tenant) redirect("/login");

  const trialEndsAt = await ensureTrialEndsAt(db, tenant);
  const billingStatus = getBillingStatus({ trialEndsAt }, subscription);

  if (billingStatus === "trial_expired") redirect("/dashboard/billing");

  return <>{children}</>;
}
