import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  // --- Tenant 1: restaurante ---
  const restaurant = await db.tenant.create({
    data: {
      name: "La Trattoria",
      slug: "la-trattoria",
      businessType: "RESTAURANT",
      plan: "PRO",
      users: {
        create: { email: "dueno@latrattoria.com", passwordHash, name: "Marco Rossi", role: "OWNER" },
      },
      subscription: { create: { plan: "PRO", status: "active" } },
    },
  });

  const entradas = await db.menuCategory.create({
    data: { tenantId: restaurant.id, name: "Entradas", sortOrder: 0 },
  });
  const fuertes = await db.menuCategory.create({
    data: { tenantId: restaurant.id, name: "Platos fuertes", sortOrder: 1 },
  });

  await db.menuItem.createMany({
    data: [
      { tenantId: restaurant.id, categoryId: entradas.id, name: "Bruschetta clásica", description: "Tomate, albahaca, ajo", price: 6.5, status: "AVAILABLE" },
      { tenantId: restaurant.id, categoryId: entradas.id, name: "Carpaccio de res", description: "Rúcula, parmesano, limón", price: 11, status: "SOLD_OUT" },
      { tenantId: restaurant.id, categoryId: fuertes.id, name: "Risotto de hongos", description: "Porcini, parmesano, trufa", price: 16, status: "AVAILABLE" },
      { tenantId: restaurant.id, categoryId: fuertes.id, name: "Osso buco", description: "Plato de temporada", price: 22, status: "SEASONAL" },
    ],
  });

  await db.review.createMany({
    data: [
      { tenantId: restaurant.id, reviewerName: "Ana G.", rating: 5, comment: "Excelente atención", source: "qr" },
      { tenantId: restaurant.id, reviewerName: "Luis P.", rating: 4, comment: "Muy rico el risotto", source: "qr" },
    ],
  });

  // --- Tenant 2: negocio de servicios ---
  const studio = await db.tenant.create({
    data: {
      name: "Studio Luna",
      slug: "studio-luna",
      businessType: "SMALL_BUSINESS",
      plan: "STARTER",
      users: {
        create: { email: "dueno@studioluna.com", passwordHash, name: "Sofía Vargas", role: "OWNER" },
      },
      subscription: { create: { plan: "STARTER", status: "trialing" } },
    },
  });

  const sofia = await db.staffMember.create({ data: { tenantId: studio.id, name: "Sofía" } });

  await db.service.createMany({
    data: [
      { tenantId: studio.id, staffId: sofia.id, name: "Corte y color", durationMinutes: 90, price: 45 },
      { tenantId: studio.id, staffId: sofia.id, name: "Manicure", durationMinutes: 40, price: 18 },
    ],
  });

  console.log("Seed listo:");
  console.log("  la-trattoria  -> dueno@latrattoria.com / password123");
  console.log("  studio-luna   -> dueno@studioluna.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
