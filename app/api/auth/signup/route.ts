import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { signSession, sessionCookieName } from "@/lib/auth";

const schema = z.object({
  businessName: z.string().min(1),
  businessType: z.enum(["RESTAURANT", "SMALL_BUSINESS"]),
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).slice(2, 6)
  );
}

// POST /api/auth/signup — punto de entrada del onboarding. Crea el tenant
// con plan STARTER en trial y el primer usuario como OWNER, todo en una
// transacción para no dejar tenants huérfanos si algo falla a mitad.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { businessName, businessType, email, password, name } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Ese correo ya está registrado" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { tenant, user } = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const tenant = await tx.tenant.create({
      data: {
        name: businessName,
        slug: slugify(businessName),
        businessType,
        plan: "STARTER",
      },
    });
    const user = await tx.user.create({
      data: { tenantId: tenant.id, email, passwordHash, name, role: "OWNER" },
    });
    await tx.subscription.create({
      data: { tenantId: tenant.id, plan: "STARTER", status: "trialing" },
    });
    // Categoría inicial para que el dashboard de menú no arranque vacío.
    if (businessType === "RESTAURANT") {
      await tx.menuCategory.create({ data: { tenantId: tenant.id, name: "Platos principales" } });
    }
    return { tenant, user };
  });

  const token = signSession({ userId: user.id, tenantId: tenant.id, role: "OWNER" });
  const res = NextResponse.json({ tenant: { slug: tenant.slug } }, { status: 201 });
  res.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
