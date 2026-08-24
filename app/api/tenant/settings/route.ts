import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";
import { TIMEZONES } from "@/lib/timezone";

const CURRENCIES = ["USD", "EUR", "MXN", "COP", "ARS", "CLP", "PEN", "BRL", "AWG"] as const;

const updateSchema = z.object({
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

  // "" para contactEmail significa "lo estoy borrando" — lo normalizamos a null.
  const data = { ...parsed.data };
  if (data.contactEmail === "") data.contactEmail = null;

  const tenant = await db.tenant.update({ where: { id: session.tenantId }, data });
  return NextResponse.json({ tenant });
}
