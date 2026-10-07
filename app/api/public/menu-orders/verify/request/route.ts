import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { createCode, normalizeOrderPhone } from "@/lib/order-verification";
import { isOrderVerifyWhatsAppConfigured, sendOrderVerificationWhatsApp } from "@/lib/whatsapp";
import { sendOrderVerificationEmail } from "@/lib/email";

const schema = z.object({
  slug: z.string(),
  phone: z.string().min(6).max(30),
  email: z.string().email(),
  language: z.enum(["es", "en"]).default("es"),
});

// POST /api/public/menu-orders/verify/request — primer paso para pedir
// DELIVERY desde el menú público: manda un código de 6 dígitos al
// cliente (WhatsApp si hay plantilla aprobada, si no al correo).
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const { slug, email, language } = parsed.data;

  const phone = normalizeOrderPhone(parsed.data.phone);
  if (phone.length < 7) return NextResponse.json({ error: "Teléfono inválido" }, { status: 400 });

  // Cada código manda un mensaje real (WhatsApp tiene costo) — se limita
  // por IP y también por teléfono para que nadie pueda inundar un número.
  const ipLimit = rateLimit(`order-verify-request-ip:${getClientIp(req)}`, 5, 60 * 60_000);
  const phoneLimit = rateLimit(`order-verify-request-phone:${phone}`, 3, 60 * 60_000);
  if (!ipLimit.allowed || !phoneLimit.allowed) {
    const retry = Math.max(ipLimit.retryAfterSeconds, phoneLimit.retryAfterSeconds);
    return NextResponse.json(
      { error: "Demasiados intentos. Espera un momento e intenta de nuevo." },
      { status: 429, headers: { "Retry-After": String(retry) } }
    );
  }

  const tenant = await db.tenant.findUnique({ where: { slug }, select: { name: true, orderingEnabled: true } });
  if (!tenant || !tenant.orderingEnabled) {
    return NextResponse.json({ error: "Los pedidos no están disponibles en este negocio." }, { status: 404 });
  }

  const created = await createCode(phone);
  if (!created.ok) {
    return NextResponse.json(
      { error: `Espera ${created.waitSeconds} segundos antes de pedir otro código.` },
      { status: 429 }
    );
  }

  // Por WhatsApp solo cuando hay plantilla aprobada (verifica el
  // teléfono de verdad); si no, el código va al correo.
  const channel: "whatsapp" | "email" = isOrderVerifyWhatsAppConfigured(language) ? "whatsapp" : "email";
  try {
    if (channel === "whatsapp") {
      await sendOrderVerificationWhatsApp({ toPhone: parsed.data.phone, code: created.code, language });
    } else {
      await sendOrderVerificationEmail(email, created.code, tenant.name, language);
    }
  } catch (err) {
    console.error("No se pudo enviar el código de verificación del pedido:", err);
    return NextResponse.json({ error: "No pudimos enviar el código. Intenta de nuevo." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, channel });
}
