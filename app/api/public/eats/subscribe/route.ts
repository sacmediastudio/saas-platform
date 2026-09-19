import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

// POST /api/public/eats/subscribe
//
// Endpoint público (sin autenticación) para el form de "Mis datos" de
// la app móvil — deja los datos de contacto y/o activa notificaciones
// de promos/specials. Todos los campos de contacto son opcionales a
// propósito (ver el modelo Subscriber): alguien puede activar solo las
// notificaciones sin dejar nombre/correo, y viceversa.
const bodySchema = z
  .object({
    name: z.string().trim().max(120).optional(),
    email: z.string().trim().email().max(200).optional().or(z.literal("")),
    phone: z.string().trim().max(40).optional(),
    // Token de Expo Push (ExponentPushToken[...]) — se genera en el
    // dispositivo al pedir permiso de notificaciones.
    pushToken: z.string().trim().min(1).optional(),
    notificationsEnabled: z.boolean().optional(),
    lang: z.enum(["es", "en"]).optional(),
  })
  .refine((data) => data.name || data.email || data.phone || data.pushToken, {
    message: "Falta al menos un dato de contacto o el token de notificaciones.",
  });

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { name, email, phone, pushToken, notificationsEnabled, lang } = parsed.data;
  const data = {
    ...(name !== undefined ? { name } : {}),
    ...(email ? { email } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(notificationsEnabled !== undefined ? { notificationsEnabled } : {}),
    ...(lang ? { lang } : {}),
  };

  // El token de push es el identificador más estable (uno por
  // instalación) — si viene, upsert por ahí. Si no, tratamos de
  // encontrar el mismo contacto por correo antes de crear uno nuevo,
  // para que reabrir el form sin token no duplique el registro.
  const subscriber = pushToken
    ? await db.subscriber.upsert({
        where: { pushToken },
        create: { pushToken, ...data },
        update: data,
      })
    : email
      ? await db.subscriber.upsert({
          where: { email },
          create: { email, ...data },
          update: data,
        })
      : await db.subscriber.create({ data });

  return NextResponse.json({ id: subscriber.id });
}
