import { PrismaClient } from "@prisma/client";

// Evita crear múltiples instancias de PrismaClient en desarrollo,
// donde Next.js recarga módulos en cada cambio de archivo.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
