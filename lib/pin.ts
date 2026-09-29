import crypto from "crypto";

// Hash del PIN de 4 dígitos de un mesero (Fase 2, Zertoo Waiter) — a
// propósito determinístico (SHA-256 + un pepper fijo), NO bcrypt: hace
// falta poder resolver "¿qué mesero tiene este PIN?" con una consulta
// directa (User.pinHash, único por tenant). La sesión JWT que ya existe
// sigue siendo el límite de seguridad real; el PIN es solo un selector
// de identidad sobre esa sesión ya autenticada, no un secreto crítico
// en sí mismo — por eso alcanza con un pepper simple en vez de un salt
// por usuario.
const PIN_PEPPER = process.env.PIN_PEPPER || "dev-pin-pepper-change-me";

export function hashPin(pin: string): string {
  return crypto.createHash("sha256").update(`${PIN_PEPPER}:${pin}`).digest("hex");
}
