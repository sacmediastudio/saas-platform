import { db } from "./db";

/**
 * Suma o actualiza el registro de "cliente" del negocio — un registro
 * por correo, sin importar cuántas veces reserve, reseñe, o reclame el
 * premio del menú. Se llama desde cada punto donde capturamos un
 * correo real (citas, reseñas con correo, leads del menú).
 */
export async function upsertCustomer(params: {
  tenantId: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  source: "booking" | "review" | "menuLead";
}): Promise<void> {
  const email = params.email.toLowerCase().trim();
  if (!email) return;

  const sourceFlag =
    params.source === "booking"
      ? { fromBooking: true }
      : params.source === "review"
        ? { fromReview: true }
        : { fromMenuLead: true };

  await db.customer.upsert({
    where: { tenantId_email: { tenantId: params.tenantId, email } },
    update: {
      ...(params.name ? { name: params.name } : {}),
      ...(params.phone ? { phone: params.phone } : {}),
      lastSeenAt: new Date(),
      ...sourceFlag,
    },
    create: {
      tenantId: params.tenantId,
      email,
      name: params.name ?? null,
      phone: params.phone ?? null,
      ...sourceFlag,
    },
  });
}
