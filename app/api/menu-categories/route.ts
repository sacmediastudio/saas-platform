import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const createSchema = z.object({ name: z.string().min(1) });

export async function POST(req: NextRequest) {
  const session = await requireTenant();
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const count = await db.menuCategory.count({ where: { tenantId: session.tenantId } });

  const category = await db.menuCategory.create({
    data: { tenantId: session.tenantId, name: parsed.data.name, sortOrder: count },
  });

  return NextResponse.json({ category }, { status: 201 });
}
