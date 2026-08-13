import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/public/faqs?slug=X — usado por el widget de chat en las 3
// páginas públicas. Sin autenticación (es contenido público del
// negocio), solo devuelve pregunta/respuesta, nada sensible.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Falta el slug" }, { status: 400 });

  const tenant = await db.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return NextResponse.json({ faqs: [] });

  const faqs = await db.faqItem.findMany({
    where: { tenantId: tenant.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, question: true, answer: true },
  });

  return NextResponse.json({ faqs });
}
