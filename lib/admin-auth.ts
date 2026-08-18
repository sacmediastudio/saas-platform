import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { db } from "./db";

// Secreto y cookie propios — a propósito distintos de lib/auth.ts (la
// sesión de tus clientes), para que un token de un lado nunca sirva del
// otro por error.
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || "dev-admin-secret-change-me";
const ADMIN_COOKIE_NAME = "admin_session";
// Cookie SEPARADA para el paso intermedio (contraseña correcta, código
// de 2FA todavía no) — nunca se confunde con la sesión real, y expira
// rápido a propósito (5 min) para que no quede colgada indefinidamente.
const PENDING_2FA_COOKIE_NAME = "admin_pending_2fa";

export interface AdminSessionPayload {
  adminId: string;
}

export interface PendingTwoFactorPayload {
  adminId: string;
  pending2FA: true;
}

export function signAdminSession(payload: AdminSessionPayload): string {
  return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn: "7d" });
}

export function signPendingTwoFactor(adminId: string): string {
  return jwt.sign({ adminId, pending2FA: true }, ADMIN_JWT_SECRET, { expiresIn: "5m" });
}

export function verifyPendingTwoFactor(token: string): PendingTwoFactorPayload | null {
  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET) as PendingTwoFactorPayload;
    return payload.pending2FA ? payload : null;
  } catch {
    return null;
  }
}

function verifyAdminSession(token: string): AdminSessionPayload | null {
  try {
    return jwt.verify(token, ADMIN_JWT_SECRET) as AdminSessionPayload;
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminSession(token);
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) {
    throw new Response(JSON.stringify({ error: "No autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const admin = await db.adminUser.findUnique({ where: { id: session.adminId } });
  if (!admin) {
    throw new Response(JSON.stringify({ error: "No autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return admin;
}

export const adminCookieName = ADMIN_COOKIE_NAME;
export const pendingTwoFactorCookieName = PENDING_2FA_COOKIE_NAME;
