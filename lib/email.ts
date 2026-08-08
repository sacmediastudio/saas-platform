// Envío de correos transaccionales. Usa Resend (https://resend.com) si hay
// una API key configurada — es el proveedor más simple de dejar andando:
// cuenta gratis, sin tarjeta, ~5 minutos de setup.
//
// SI NO HAY API KEY CONFIGURADA (RESEND_API_KEY en las variables de
// entorno), el contenido del correo se imprime en los logs del servidor
// en vez de enviarse real. Esto mantiene el flujo funcional para
// probar/desarrollar, pero NO es seguro para producción real con
// usuarios reales — configura RESEND_API_KEY antes de lanzar.

async function sendEmail(to: string, subject: string, html: string, logFallback: string) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`\n[EMAIL NO CONFIGURADO] ${logFallback}\n`);
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
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`Error enviando email ("${subject}"):`, res.status, body);
    // No lanzamos error: preferimos que la acción real (signup, booking)
    // no falle solo porque el correo no salió.
  }
}

export async function sendVerificationEmail(to: string, code: string, businessName: string) {
  await sendEmail(
    to,
    `Tu código de verificación: ${code}`,
    `
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
    `Código de verificación para ${to}: ${code}\nConfigura RESEND_API_KEY para enviar correos reales. Ver lib/email.ts.`
  );
}

export function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendBookingConfirmationEmail(params: {
  to: string;
  customerName: string;
  businessName: string;
  serviceName: string;
  datetime: Date;
  contactPhone?: string | null;
}) {
  const { to, customerName, businessName, serviceName, datetime, contactPhone } = params;
  const formattedDate = datetime.toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const formattedTime = datetime.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

  await sendEmail(
    to,
    `Tu cita en ${businessName} está confirmada`,
    `
      <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto; padding: 24px;">
        <p style="font-size: 14px; color: #343233;">Hola ${customerName},</p>
        <p style="font-size: 14px; color: #343233;">
          Tu cita en <strong>${businessName}</strong> quedó confirmada:
        </p>
        <div style="background: #F7F8F4; border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="font-size: 15px; font-weight: 700; color: #002D09; margin: 0 0 4px;">${serviceName}</p>
          <p style="font-size: 14px; color: #343233; margin: 0; text-transform: capitalize;">${formattedDate}</p>
          <p style="font-size: 14px; color: #343233; margin: 4px 0 0;">${formattedTime}</p>
        </div>
        ${contactPhone ? `<p style="font-size: 13px; color: #888;">¿Necesitas reprogramar? Contacta al negocio: ${contactPhone}</p>` : ""}
      </div>
    `,
    `Confirmación de cita para ${to}: ${serviceName} el ${formattedDate} a las ${formattedTime}.\nConfigura RESEND_API_KEY para enviar correos reales.`
  );
}
