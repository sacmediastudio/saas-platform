# SaaS platform — menú, reservas y reseñas

Esqueleto funcional de la plataforma: Next.js 14 (App Router) + TypeScript +
Prisma + PostgreSQL. Multi-tenant por fila (`tenantId` en cada tabla).

## Poner en marcha

```bash
npm install
cp .env.example .env        # completa DATABASE_URL y JWT_SECRET
npm run db:push             # crea las tablas a partir de prisma/schema.prisma
npm run db:seed             # carga 2 negocios de ejemplo con datos
npm run dev
```

> **Nota sobre despliegues (específico de Railway):** el script `start`
> corre `prisma db push` antes de `next start`, no el `build`. Esto es
> intencional: en Railway, el contenedor de *build* no tiene acceso a la
> red privada donde vive la base de datos (`*.railway.internal`) — esa
> red solo está disponible una vez que el contenedor está corriendo. Si
> pones `prisma db push` en el `build`, vas a ver un error `P1001: Can't
> reach database server`. Con el esquema sincronizándose en el arranque,
> cada deploy sigue aplicando cambios de esquema automáticamente, sin
> depender de correr `railway run npx prisma db push` a mano — solo que
> ahora pasa en el momento correcto del ciclo de deploy.

Necesitas una base PostgreSQL corriendo. La forma más rápida en local:

```bash
docker run --name saas-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
```

Usuarios de prueba tras el seed:
- `dueno@latrattoria.com` / `password123` (restaurante, plan Pro)
- `dueno@studioluna.com` / `password123` (negocio de servicios, plan Starter)

(El login endpoint ya existe en `/api/auth/login`; falta la página de UI
`/login` — ver "Qué falta" abajo.)

## Estructura

```
app/
  api/
    auth/signup, auth/login     — onboarding y login
    menu-items/                 — CRUD de platos (dashboard)
    bookings/                   — agenda + creación pública de citas
    reviews/                    — reseñas, creación pública + moderación
  dashboard/
    layout.tsx                  — nav lateral, resuelve el tenant de la sesión
    menu/                       — editor de menú (server + client component)
    bookings/, reviews/         — pendientes, mismo patrón que menu/
  menu/[slug]/, book/[slug]/    — páginas públicas (QR del cliente final)
lib/
  db.ts                         — cliente Prisma singleton
  auth.ts                       — sesión JWT en cookie httpOnly + requireTenant()
prisma/
  schema.prisma                 — modelo de datos completo
  seed.ts                       — datos de ejemplo
```

## Principio de multi-tenancy

Toda query autenticada pasa por `requireTenant()` en `lib/auth.ts`, que lee
el `tenantId` de la sesión (JWT en cookie), nunca del body o los query
params de la request. Cada `findFirst`/`update`/`delete` de un recurso
filtra por `{ id, tenantId }` juntos — así una URL adivinada por otro
tenant devuelve 404 en vez de exponer que el registro existe.

## Ya construido

- [x] `/login`, `/signup` — onboarding completo, crea tenant + owner
- [x] `/dashboard/menu`, `/dashboard/bookings`, `/dashboard/reviews` — CRUD +
      moderación, con actualización optimista en el cliente
- [x] `/menu/[slug]` — página pública de menú (vista del cliente vía QR)
- [x] `/book/[slug]` — flujo de reserva de 3 pasos, conectado a la API real
      (incluye el chequeo de solapamiento de horarios en el backend)
- [x] Modal "Agregar plato" en el dashboard de menú (nombre, categoría,
      precio, descripción)
- [x] Modal "Nueva cita" en el dashboard de bookings — el dueño registra
      una cita manual (llamada telefónica, walk-in), queda CONFIRMED de
      inmediato vía `POST /api/bookings/manual`
- [x] Modal "Bloquear horario" — vacaciones, almuerzo, cierre por
      mantenimiento. Se guarda en la tabla `availability_blocks` y tanto
      la reserva pública como la manual rechazan citas que se solapen
      con un bloqueo activo
- [x] Fotos de platos: se suben desde el modal, se redimensionan en el
      navegador (canvas) y se guardan como data URI en `imageUrl` — no
      requiere S3/R2 configurado para funcionar ya, pero no es la
      solución ideal a largo plazo (ver "Qué falta")
- [x] Categorías del menú: crear, renombrar y borrar (bloquea el borrado
      si la categoría todavía tiene platos, para no perder datos sin
      querer)
- [x] Editar y borrar platos individuales (antes solo se podía crear y
      cambiar el estado)
- [x] Separación de módulos por tipo de negocio: un restaurante no ve
      "Citas" en su nav ni puede llegar a `/dashboard/bookings` por URL
      directa (redirige a `/dashboard/menu`), y viceversa para un
      negocio de servicios
- [x] Página de Ajustes (`/dashboard/settings`) completa: nombre del
      negocio, logo, foto principal (hero), correo/teléfono/dirección de
      contacto, moneda (afecta cómo se muestran todos los precios, en
      dashboard y páginas públicas), colores de fondo/texto de la página
      pública, y cerrar sesión
- [x] Tercer pilar: **Smartlink** (`/dashboard/smartlink` +
      `/link/[slug]`) — un perfil tipo Linktree con foto, nombre y una
      lista de links reordenable (sitio web, WhatsApp, teléfono, redes
      sociales, Maps, o un link personalizado). WhatsApp y teléfono se
      arman automáticamente como `wa.me/...` y `tel:...`; el resto son
      URLs directas que el usuario pega. El signup ahora tiene 3
      opciones de tipo de negocio, y cada dashboard solo muestra el
      módulo que le corresponde (con guard de redirección también por
      URL directa, igual que los otros dos módulos)

## Qué falta (siguiente iteración)

- [ ] Storage real de imágenes (S3 o Cloudflare R2). Hoy las fotos se
      guardan como data URI directo en la base de datos — funciona, pero
      no escala bien si suben muchas fotos pesadas. Migrar es sencillo:
      solo hay que cambiar `resizeImageToDataUrl` en `menu-editor.tsx`
      por una subida real, y el resto del código sigue igual porque
      `imageUrl` ya es solo un string
- [ ] Integración real de Stripe Billing (checkout + webhook de suscripción)
- [ ] Envío de email/SMS de confirmación (SendGrid/Twilio) al crear o
      confirmar un booking — hay un `TODO` marcado en el código exacto
      donde va
- [ ] Página `/review/[slug]` para que el cliente deje su reseña (el
      endpoint `POST /api/reviews` ya existe y funciona)
- [ ] Tests automatizados de los endpoints de API
- [ ] Reemplazar los estilos inline por Tailwind/componentes reutilizables
      — están así para que cada archivo sea legible de un vistazo

## Stack

Next.js 14 · TypeScript · Prisma · PostgreSQL · Zod (validación) · bcryptjs +
JWT (auth propia, sin dependencias externas de auth) · Stripe (pendiente de
cablear) · Tailwind (para las páginas de UI que faltan)
