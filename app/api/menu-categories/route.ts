import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

const createSchema = z.object({
  name: z.string().min(1),
  nameEn: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const session = await requirePermission("MENU");
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Al final de la lista: max+1 (no la cantidad, que repetiría un valor
  // existente si antes se borró una categoría del medio).
  const last = await db.menuCategory.aggregate({ where: { tenantId: session.tenantId }, _max: { sortOrder: true } });

  const category = await db.menuCategory.create({
    data: {
      tenantId: session.tenantId,
      name: parsed.data.name,
      nameEn: parsed.data.nameEn || null,
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json({ category }, { status: 201 });
}
