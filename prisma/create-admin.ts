// Uso: npx tsx prisma/create-admin.ts "tu@correo.com" "contraseña" "Tu Nombre"
//
// No hay una página pública de signup para el panel de admin a
// propósito — crear un admin nuevo siempre pasa por este script, que
// solo puede correr alguien con acceso a la base de datos/servidor.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const [, , email, password, name] = process.argv;

  if (!email || !password || !name) {
    console.error('Uso: npx tsx prisma/create-admin.ts "correo@ejemplo.com" "contraseña" "Nombre"');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("La contraseña debe tener al menos 8 caracteres.");
    process.exit(1);
  }

  const existing = await db.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.error("Ya existe un admin con ese correo.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await db.adminUser.create({ data: { email, passwordHash, name } });

  console.log(`Admin creado: ${admin.email} (${admin.id})`);
  console.log("Ya puedes entrar en /admin/login con ese correo y contraseña.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
