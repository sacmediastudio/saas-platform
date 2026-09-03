export type BillingStatus = "trialing" | "trial_expired" | "active" | "past_due" | "canceled";

/**
 * Los negocios creados ANTES de este cambio no tienen `trialEndsAt`
 * guardado — en vez de pedir correr una migración aparte (este
 * proyecto usa `prisma db push`, no migraciones tradicionales), se
 * completa solo: la primera vez que un negocio así pasa por acá, se le
 * calcula una fecha justa (fecha de creación + 7 días, no "7 días
 * desde hoy") y se guarda. Así nadie con un trial en curso queda
 * cortado de golpe el día que esto se despliega.
 */
export async function ensureTrialEndsAt(
  db: { tenant: { update: (args: any) => Promise<any> } },
  tenant: { id: string; createdAt: Date; trialEndsAt: Date | null }
): Promise<Date> {
  if (tenant.trialEndsAt) return tenant.trialEndsAt;

  const fairTrialEnd = new Date(tenant.createdAt.getTime() + 14 * 24 * 60 * 60_000);
  await db.tenant.update({ where: { id: tenant.id }, data: { trialEndsAt: fairTrialEnd } });
  return fairTrialEnd;
}

/**
 * Calcula el estado real de facturación — un solo lugar del que
 * depende todo lo demás (el aviso en el dashboard, y el bloqueo real
 * de activar módulos), para no tener esta lógica duplicada y
 * potencialmente desalineada en varios archivos.
 */
export function getBillingStatus(
  tenant: { trialEndsAt: Date | null },
  subscription: { status: string; stripeSubscriptionId: string | null } | null
): BillingStatus {
  // Una suscripción real de Stripe manda por encima del trial, sea
  // cual sea su estado.
  if (subscription?.stripeSubscriptionId) {
    if (subscription.status === "active") return "active";
    if (subscription.status === "past_due") return "past_due";
    if (subscription.status === "canceled") return "canceled";
  }

  if (tenant.trialEndsAt && tenant.trialEndsAt.getTime() > Date.now()) return "trialing";
  return "trial_expired";
}

/** Cuántos días le quedan del trial (0 si ya venció o nunca se fijó fecha). Solo para mostrar en el aviso. */
export function trialDaysLeft(tenant: { trialEndsAt: Date | null }): number {
  if (!tenant.trialEndsAt) return 0;
  const ms = tenant.trialEndsAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/** Puede activar un módulo NUEVO gratis solo durante el trial vigente, o si ya paga de verdad. */
export function canActivateNewModule(status: BillingStatus): boolean {
  return status === "trialing" || status === "active";
}
