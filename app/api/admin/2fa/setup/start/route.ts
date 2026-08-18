import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { generateTwoFactorSecret, getOtpAuthUrl, generateQrCodeDataUrl } from "@/lib/two-factor";

// POST /api/admin/2fa/setup/start — genera un secreto NUEVO cada vez
// que se llama, y todavía no lo guarda en la base de datos — recién se
// guarda cuando el admin confirma que sí lo configuró bien (ver
// /api/admin/2fa/setup/confirm). Así, si abandona el proceso a medias,
// no queda un secreto huérfano activado por accidente.
export async function POST() {
  const admin = await requireAdmin();

  const secret = generateTwoFactorSecret();
  const otpAuthUrl = getOtpAuthUrl(admin.email, secret);
  const qrCodeDataUrl = await generateQrCodeDataUrl(otpAuthUrl);

  return NextResponse.json({ secret, qrCodeDataUrl });
}
