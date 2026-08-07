export type ModuleType = "RESTAURANT" | "SMALL_BUSINESS" | "SMARTLINK";

export const MODULE_ORDER: ModuleType[] = ["RESTAURANT", "SMALL_BUSINESS", "SMARTLINK"];

export const MODULE_LABELS: Record<ModuleType, string> = {
  RESTAURANT: "Menú",
  SMALL_BUSINESS: "Citas",
  SMARTLINK: "Smartlink",
};

export const MODULE_DESCRIPTIONS: Record<ModuleType, string> = {
  RESTAURANT: "Menú digital con fotos, categorías y platos destacados.",
  SMALL_BUSINESS: "Agenda de citas, reservas online y bloqueo de horarios.",
  SMARTLINK: "Un perfil con todos tus enlaces, listo para compartir.",
};

/**
 * Qué módulos tiene activos un negocio. Si `enabledModules` está vacío
 * (cuentas creadas antes de este cambio), cae de vuelta a su
 * `businessType` original — así ninguna cuenta existente se queda sin
 * acceso a lo que ya tenía por no haber corrido una migración de datos.
 */
export function getEnabledModules(tenant: {
  businessType: ModuleType;
  enabledModules: ModuleType[];
}): ModuleType[] {
  if (tenant.enabledModules && tenant.enabledModules.length > 0) return tenant.enabledModules;
  return [tenant.businessType];
}

export function moduleDashboardPath(m: ModuleType): string {
  if (m === "RESTAURANT") return "/dashboard/menu";
  if (m === "SMALL_BUSINESS") return "/dashboard/bookings";
  return "/dashboard/smartlink";
}

export function modulePublicPrefix(m: ModuleType): "menu" | "book" | "link" {
  if (m === "RESTAURANT") return "menu";
  if (m === "SMALL_BUSINESS") return "book";
  return "link";
}
