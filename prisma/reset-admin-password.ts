// Uso: npx tsx prisma/reset-admin-password.ts "correo@existente.com" "nueva-contraseña"
//
// Para cuando ya existe una cuenta de admin pero se perdió/olvidó la
// contraseña. No hay flujo de "olvidé mi contraseña" en /admin a
// propósito (por seguridad) — el cambio siempre pasa por acá, con
// acceso directo a la base de datos.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const [, , email, newPassword] = process.argv;

  if (!email || !newPassword) {
    console.error('Uso: npx tsx prisma/reset-admin-password.ts "correo@existente.com" "nueva-contraseña"');
    process.exit(1);
  }
  if (newPassword.length < 8) {
    console.error("La contraseña debe tener al menos 8 caracteres.");
    process.exit(1);
  }

  const admin = await db.adminUser.findUnique({ where: { email } });
  if (!admin) {
    console.error(`No existe ningún admin con el correo ${email}.`);
    console.error("Si quieres crear uno nuevo, usa prisma/create-admin.ts en su lugar.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.adminUser.update({ where: { email }, data: { passwordHash } });

  console.log(`Contraseña actualizada para ${email}.`);
  console.log("Ya puedes entrar en /admin/login con la nueva contraseña.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
