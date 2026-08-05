import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth";

const schema = z.object({ status: z.enum(["PUBLISHED", "HIDDEN", "REPORTED"]) });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireTenant();

  const existing = await db.review.findFirst({ where: { id: params.id, tenantId: session.tenantId } });
  if (!existing) {
    return NextResponse.json({ error: "Reseña no encontrada" }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const review = await db.review.update({ where: { id: params.id }, data: { status: parsed.data.status } });
  return NextResponse.json({ review });
}
