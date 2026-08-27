import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";
import { TIMEZONES } from "@/lib/timezone";
import { geocodeAddress, isGeocodingConfigured } from "@/lib/geocoding";
import { getEnabledModules } from "@/lib/modules";

const CURRENCIES = ["USD", "EUR", "MXN", "COP", "ARS", "CLP", "PEN", "BRL", "AWG"] as const;

// Mismos 13 valores que el enum NowCategory de Prisma — tienen que
// coincidir exacto. Solo restaurantes — Zertoo Eats quedó enfocado
// exclusivamente ahí.
const NOW_CATEGORIES = [
  "ITALIAN",
  "FRENCH",
  "INTERNATIONAL",
  "ASIAN",
  "CRIOLLA",
  "STEAKHOUSE",
  "SEAFOOD",
  "FAST_FOOD",
  "CAFE_DESSERTS",
  "PIZZERIA",
  "SUSHI",
  "BAR_PUB",
  "VEGETARIAN",
] as const;

const updateSchema = z
  .object({
    name: z.string().min(1).optional(),
    logoUrl: z.string().min(1).nullable().optional(),
    heroImageUrl: z.string().min(1).nullable().optional(),
    heroTagline: z.string().max(200).nullable().optional(),
    menuShowPhotos: z.boolean().optional(),
    contactEmail: z.string().email().nullable().optional().or(z.literal("")),
    contactPhone: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    currency: z.enum(CURRENCIES).optional(),
    timezone: z.enum(TIMEZONES).optional(),
    themeBgColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido")
      .optional(),
    themeTextColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido")
      .optional(),
    buttonColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido")
      .optional(),
    buttonTextColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido")
      .optional(),
    menuCardColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido")
      .optional(),
    menuPageTextColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido")
      .optional(),
    nowEnabled: z.boolean().optional(),
    nowCategory: z.enum(NOW_CATEGORIES).nullable().optional(),
  })
  .refine((data) => !data.nowEnabled || data.nowCategory, {
    message: "Elegí una categoría para aparecer en Zertoo Eats.",
    path: ["nowCategory"],
  });

export async function GET() {
  const session = await requireTenant();
  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } });
  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ tenant });
}

export async function PATCH(req: NextRequest) {
  const session = await requireTenant();
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.tenant.findUnique({ where: { id: session.tenantId } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Validación real en el servidor, no solo esconder el checkbox en la
  // interfaz — Zertoo Eats es solo para negocios con el módulo de Menú
  // activo, sin importar qué mande la solicitud.
  const effectiveNowEnabled = parsed.data.nowEnabled ?? existing.nowEnabled;
  if (effectiveNowEnabled && !getEnabledModules(existing).includes("RESTAURANT")) {
    return NextResponse.json(
      { error: "Zertoo Eats es solo para negocios con el módulo de Menú activo." },
      { status: 400 }
    );
  }

  // "" para contactEmail significa "lo estoy borrando" — lo normalizamos a null.
  const data: typeof parsed.data & { latitude?: number; longitude?: number } = { ...parsed.data };
  if (data.contactEmail === "") data.contactEmail = null;

  // Geocodifica la dirección — solo cuando hace falta: al activar
  // Zertoo Eats por primera vez (sin coordenadas todavía), o si la
  // dirección cambió mientras ya estaba activo. No se llama en cada
  // guardado de ajustes, solo cuando el resultado podría haber
  // cambiado — así el volumen de llamadas se queda bajo.
  const effectiveAddress = data.address !== undefined ? data.address : existing.address;
  const addressChanged = data.address !== undefined && data.address !== existing.address;

  if (isGeocodingConfigured() && effectiveNowEnabled && effectiveAddress && (addressChanged || existing.latitude === null)) {
    const coords = await geocodeAddress(effectiveAddress);
    if (coords) {
      data.latitude = coords.lat;
      data.longitude = coords.lng;
    }
    // Si falla, no bloqueamos el guardado del resto de los ajustes —
    // el negocio igual queda activo en Zertoo Eats, solo que sin
    // coordenadas todavía (no aparece en "cerca de mí" hasta que se
    // resuelva, pero sí en el resto del directorio).
  }

  const tenant = await db.tenant.update({ where: { id: session.tenantId }, data });
  return NextResponse.json({ tenant });
}
