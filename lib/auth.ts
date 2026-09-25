import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { type PermissionKey } from "./permissions";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const COOKIE_NAME = "session";

export interface SessionPayload {
  userId: string;
  tenantId: string;
  role: "OWNER" | "STAFF";
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Lee la sesión actual desde la cookie httpOnly.
 * Devuelve null si no hay sesión válida — cada API route decide qué
 * hacer con eso (normalmente responder 401).
 */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

/**
 * Punto único por el que toda query autenticada obtiene su tenantId.
 * Nunca confíes en un tenantId que venga del body/query del cliente:
 * siempre derívalo de la sesión, para que un tenant jamás pueda leer
 * o escribir datos de otro.
 */
export async function requireTenant(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Response(JSON.stringify({ error: "No autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return session;
}

/**
 * Igual que requireTenant(), pero además exige que la sesión sea del
 * dueño (OWNER) — para lo que nunca debería poder hacer un STAFF así
 * tenga todos los permisos activados, porque le daría forma de
 * escalar su propio acceso: administrar al resto del staff (crear
 * cuentas, tocar sus permisos, borrarlas). El chequeo de rol vive acá,
 * en el server, a propósito — nunca alcanza con solo esconder el
 * botón en el frontend.
 */
export async function requireOwner(): Promise<SessionPayload> {
  const session = await requireTenant();
  if (session.role !== "OWNER") {
    throw new Response(JSON.stringify({ error: "Esta acción solo puede hacerla el dueño del negocio." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return session;
}

/**
 * Igual que requireTenant(), pero además exige el permiso puntual
 * `perm` — para las secciones del dashboard que el dueño puede
 * activar/desactivar por staff desde /dashboard/team (facturación,
 * módulos, ajustes del negocio, pedidos, menú, etc). El OWNER siempre
 * pasa, sin importar qué tenga guardado en `permissions` — ese campo
 * solo es significativo para STAFF. Se lee de la base y no del JWT
 * porque el dueño puede cambiarle los permisos a alguien que ya tiene
 * una sesión abierta, y tiene que aplicarse en el próximo request, no
 * recién cuando esa persona vuelva a iniciar sesión.
 */
export async function requirePermission(perm: PermissionKey): Promise<SessionPayload> {
  const session = await requireTenant();
  if (session.role === "OWNER") return session;

  const user = await db.user.findUnique({ where: { id: session.userId }, select: { permissions: true } });
  if (!user?.permissions.includes(perm)) {
    throw new Response(JSON.stringify({ error: "No tienes permiso para acceder a esta sección." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return session;
}

/**
 * Para usar directo en un Server Component de página (no en un route
 * handler): mismo chequeo que requirePermission(), pero en vez de
 * tirar una Response cruda — que en una página renderiza como error
 * feo, no como un 403 prolijo — manda a un STAFF sin ese permiso de
 * vuelta a /dashboard con un redirect normal. Un STAFF que entra a la
 * URL a mano sin tener el toggle activado rebota acá, no solo cuando
 * el link ya está escondido/gris en el nav.
 */
export async function requirePagePermission(perm: PermissionKey): Promise<SessionPayload> {
  const session = await requireTenant();
  if (session.role === "OWNER") return session;

  const user = await db.user.findUnique({ where: { id: session.userId }, select: { permissions: true } });
  if (!user?.permissions.includes(perm)) {
    redirect("/dashboard");
  }
  return session;
}

export const sessionCookieName = COOKIE_NAME;
