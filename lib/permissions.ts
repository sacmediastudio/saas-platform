// Cada clave corresponde a una sección del dashboard (más o menos 1 a 1
// con los items del nav en components/dashboard-shell.tsx). El dueño
// (OWNER) siempre tiene acceso a todo — este listado y el toggle en
// /dashboard/team solo importan para cuentas STAFF, ver
// requirePermission() en lib/auth.ts.
export const PERMISSION_KEYS = [
  "ORDERS",
  "MENU",
  "MENU_LEADS",
  "BOOKINGS",
  "SMARTLINK",
  "REVIEWS",
  "CUSTOMERS",
  "FAQS",
  "PROMOTIONS",
  "LOYALTY",
  "MODULES",
  "BILLING",
  "SETTINGS",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

// Antes de este sistema, todo lo de acá abajo ya estaba abierto a
// cualquier sesión del tenant (requireTenant), y solo facturación,
// módulos y ajustes exigían ser el dueño (requireOwner). Un STAFF
// nuevo arranca con exactamente ese mismo acceso — no cambia nada para
// nadie hasta que el dueño entre a /dashboard/team y mueva un toggle.
export const DEFAULT_STAFF_PERMISSIONS: PermissionKey[] = [
  "ORDERS",
  "MENU",
  "MENU_LEADS",
  "BOOKINGS",
  "SMARTLINK",
  "REVIEWS",
  "CUSTOMERS",
  "FAQS",
  "PROMOTIONS",
  "LOYALTY",
];

// Algunos permisos solo tienen sentido si el negocio tiene el módulo
// correspondiente activo — si no, el nav ya esconde esa sección sin
// importar el permiso, así que ni vale la pena mostrar el toggle.
export const PERMISSION_MODULE_DEPENDENCY: Partial<Record<PermissionKey, "RESTAURANT" | "SMALL_BUSINESS" | "SMARTLINK">> = {
  MENU: "RESTAURANT",
  MENU_LEADS: "RESTAURANT",
  ORDERS: "RESTAURANT",
  BOOKINGS: "SMALL_BUSINESS",
  SMARTLINK: "SMARTLINK",
};
