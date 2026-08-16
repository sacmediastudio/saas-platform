import { db } from "./db";

/**
 * Suma un sello a la tarjeta del cliente (identificado por su correo)
 * cuando se confirma una visita — hoy solo se llama al confirmar una
 * cita, se puede extender a otros módulos más adelante. Si el negocio
 * no tiene el programa activado, no hace nada.
 */
export async function addLoyaltyStamp(params: {
  tenantId: string;
  customerEmail: string;
  customerName: string;
}): Promise<{ stamps: number; visitsNeeded: number; justEarnedReward: boolean } | null> {
  const tenant = await db.tenant.findUnique({
    where: { id: params.tenantId },
    select: { loyaltyEnabled: true, loyaltyVisitsNeeded: true },
  });
  if (!tenant?.loyaltyEnabled) return null;

  // Normalizado igual que en la consulta pública (lib/api/public/loyalty)
  // — si no coincidieran, un cliente que escriba su correo con
  // mayúsculas distintas no encontraría su propia tarjeta.
  const email = params.customerEmail.toLowerCase().trim();

  const card = await db.loyaltyCard.upsert({
    where: { tenantId_customerEmail: { tenantId: params.tenantId, customerEmail: email } },
    update: { stamps: { increment: 1 }, lastVisitAt: new Date(), customerName: params.customerName },
    create: {
      tenantId: params.tenantId,
      customerEmail: email,
      customerName: params.customerName,
      stamps: 1,
    },
  });

  const visitsNeeded = tenant.loyaltyVisitsNeeded;
  const justEarnedReward = card.stamps > 0 && card.stamps % visitsNeeded === 0;

  return { stamps: card.stamps, visitsNeeded, justEarnedReward };
}
