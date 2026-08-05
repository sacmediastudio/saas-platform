import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const createSchema = z.object({
  tenantSlug: z.string(),
  reviewerName: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
  source: z.enum(["qr", "booking", "manual"]).default("qr"),
});

// GET /api/reviews — reseñas del tenant autenticado, para el panel de
// moderación del dashboard.
export async function GET() {
  const session = await requireTenant();
  const reviews = await db.review.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ reviews });
}

// POST /api/reviews — endpoint público: cualquier cliente final puede
// dejar una reseña sin autenticarse, identificando el negocio por slug.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { tenantSlug, ...data } = parsed.data;
  const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  const review = await db.review.create({
    data: {
      tenantId: tenant.id,
      status: "PUBLISHED", // se puede cambiar a "requiere aprobación" por plan
      ...data,
    },
  });

  return NextResponse.json({ review }, { status: 201 });
}
