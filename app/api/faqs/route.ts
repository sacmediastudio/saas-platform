import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

const createSchema = z.object({
  question: z.string().min(1).max(200),
  answer: z.string().min(1).max(1000),
});

export async function GET() {
  const session = await requirePermission("FAQS");
  const faqs = await db.faqItem.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ faqs });
}

export async function POST(req: NextRequest) {
  const session = await requirePermission("FAQS");
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const count = await db.faqItem.count({ where: { tenantId: session.tenantId } });
  const faq = await db.faqItem.create({
    data: { tenantId: session.tenantId, ...parsed.data, sortOrder: count },
  });

  return NextResponse.json({ faq }, { status: 201 });
}
