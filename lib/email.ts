// Envía el correo de verificación. Usa Resend (https://resend.com) si hay
// una API key configurada — es el proveedor más simple de dejar andando:
// cuenta gratis, sin tarjeta, ~5 minutos de setup.
//
// SI NO HAY API KEY CONFIGURADA (RESEND_API_KEY en las variables de
// entorno), el código de verificación se imprime en los logs del
// servidor en vez de enviarse por correo real. Esto mantiene el flujo
// funcional para probar/desarrollar, pero NO es seguro para producción
// real: cualquiera que vea los logs vería el código. Configura
// RESEND_API_KEY antes de lanzar esto con usuarios reales.
export async function sendVerificationEmail(to: string, code: string, businessName: string) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(
      `\n[EMAIL NO CONFIGURADO] Código de verificación para ${to}: ${code}\n` +
        `Configura RESEND_API_KEY para enviar correos reales. Ver lib/email.ts.\n`
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "Zertoo <onboarding@resend.dev>",
      to,
      subject: `Tu código de verificación: ${code}`,
      html: `
        <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto; padding: 24px;">
          <p style="font-size: 14px; color: #343233;">Hola,</p>
          <p style="font-size: 14px; color: #343233;">
            Usa este código para verificar tu cuenta de <strong>${businessName}</strong> en Zertoo:
          </p>
          <p style="font-size: 32px; font-weight: 800; letter-spacing: 4px; color: #002D09; margin: 24px 0;">
            ${code}
          </p>
          <p style="font-size: 12px; color: #888;">Este código expira en 15 minutos.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Error enviando email de verificación:", res.status, body);
    // No lanzamos error: preferimos que el signup no falle por esto.
    // El código sigue quedando guardado y se puede reenviar.
  }
}

export function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
