import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

export async function GET() {
  const session = await requireTenant();

  const [services, staff] = await Promise.all([
    db.service.findMany({ where: { tenantId: session.tenantId } }),
    db.staffMember.findMany({ where: { tenantId: session.tenantId } }),
  ]);

  const serializedServices = services.map((s) => ({ ...s, price: Number(s.price) }));

  return NextResponse.json({ services: serializedServices, staff });
}

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  imageUrl: z.string().min(1).nullable().optional(),
  durationMinutes: z.number().int().positive(),
  price: z.number().positive(),
  staffId: z.string().nullable().optional(),
});

// POST /api/services — crea un servicio nuevo para el negocio.
export async function POST(req: NextRequest) {
  const session = await requireTenant();
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const service = await db.service.create({
    data: { tenantId: session.tenantId, ...parsed.data },
  });

  return NextResponse.json({ service: { ...service, price: Number(service.price) } }, { status: 201 });
}
