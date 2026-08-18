import { authenticator } from "otplib";
import QRCode from "qrcode";

/** Genera un secreto nuevo, en base32 — se guarda en el admin recién cuando confirma que sí lo configuró bien. */
export function generateTwoFactorSecret(): string {
  return authenticator.generateSecret();
}

/** URL otpauth:// que cualquier app de autenticación (Google Authenticator, Authy, 1Password, etc.) entiende. */
export function getOtpAuthUrl(email: string, secret: string): string {
  return authenticator.keyuri(email, "Zertoo Admin", secret);
}

/** El mismo otpauth:// pero como imagen (data URL), para poder escanearlo directo con la cámara. */
export async function generateQrCodeDataUrl(otpAuthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUrl);
}

/** Verifica el código de 6 dígitos que el admin escribió contra su secreto guardado. */
export function verifyTwoFactorToken(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}
