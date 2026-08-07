import { db } from "./db";

type AdminAction = "SUSPEND" | "UNSUSPEND" | "DELETE_TENANT" | "UPDATE_SUBSCRIPTION";

export async function logAdminActivity(params: {
  adminEmail: string;
  action: AdminAction;
  tenantId?: string;
  tenantName: string;
  details?: string;
}) {
  try {
    await db.adminActivityLog.create({
      data: {
        adminEmail: params.adminEmail,
        action: params.action,
        tenantId: params.tenantId,
        tenantName: params.tenantName,
        details: params.details,
      },
    });
  } catch (err) {
    // El log nunca debe tumbar la acción real que se estaba haciendo.
    console.error("No se pudo registrar la actividad de admin:", err);
  }
}
