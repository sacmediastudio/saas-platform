import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { db } from "./db";

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

export const sessionCookieName = COOKIE_NAME;
