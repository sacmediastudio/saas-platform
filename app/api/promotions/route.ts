import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const createSchema = z.object({
  kind: z.enum(["PROMO", "SPECIAL"]).default("PROMO"),
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

export async function GET() {
  const session = await requireTenant();
  const promotions = await db.promotion.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ promotions });
}

export async function POST(req: NextRequest) {
  const session = await requireTenant();
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { startsAt, endsAt, ...rest } = parsed.data;
  const promotion = await db.promotion.create({
    data: {
      tenantId: session.tenantId,
      ...rest,
      startsAt: startsAt ? new Date(startsAt) : undefined,
      endsAt: endsAt ? new Date(endsAt) : undefined,
    },
  });

  return NextResponse.json({ promotion }, { status: 201 });
}
