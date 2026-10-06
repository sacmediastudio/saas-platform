import crypto from "crypto";

// Cuenta demo para App Review de Apple (Guideline 2.1a): el revisor no
// puede recibir el código de 6 dígitos por correo, así que UN correo
// (REVIEW_DEMO_EMAIL) acepta un código fijo (REVIEW_DEMO_CODE). Ambos
// viven solo en variables de entorno — sin las dos definidas, esto no
// hace nada y el login por correo funciona como siempre.
export function isReviewDemoEmail(email: string): boolean {
  const demoEmail = process.env.REVIEW_DEMO_EMAIL?.toLowerCase().trim();
  const demoCode = process.env.REVIEW_DEMO_CODE;
  return !!demoEmail && !!demoCode && email === demoEmail;
}

export function reviewDemoCodeMatches(code: string): boolean {
  const demoCode = process.env.REVIEW_DEMO_CODE ?? "";
  const a = Buffer.from(code);
  const b = Buffer.from(demoCode);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
