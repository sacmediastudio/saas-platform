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
- [x] Rediseño completo de `/menu/[slug]`: hero de pantalla completa con
      foto principal, nombre y descripción corta (editables en Ajustes),
      botón "Ver menú" que hace scroll suave; sección de "Destacados"
      (hasta 2 platos marcados como tal desde el dashboard); nav de
      categorías pegajosa (sticky) con scroll-spy que resalta la
      categoría activa mientras el usuario hace scroll; lista de platos
      sin fotos, con precio alineado a la derecha; botón flotante de
      "Llamar" si el negocio tiene teléfono configurado
- [x] Landing page (`/`) — **réplica exacta del sitio real** (portada
      desde el export de código de zertoo.app: mismos componentes,
      mismo copy, mismas imágenes reales alojadas en tu CDN de
      Hostinger, misma paleta en HSL, tipografía Plus Jakarta Sans, y
      las animaciones de scroll con `framer-motion` — incluye el header
      con menú hamburguesa animado en mobile, el marquee infinito, el
      subrayado animado en "minutos", el acordeón de FAQ, y la banda de
      CTA final. Única desviación intencional: los botones "Empieza
      gratis" enlazan a `/signup` (con `?type=X` en los de precios, que
      preselecciona el tipo de negocio) en vez de anclar a `#top` como
      en la plantilla original, porque en nuestro caso sí existe un
      signup funcional para enlazar.
- [x] **Rebranding completo de los 3 dashboards**: tema claro (blanco/
      verde bosque/lima), con el logo de Zertoo en la parte superior del
      sidebar en los tres módulos (Menú, Citas, Smartlink), reemplazando
      el tema oscuro genérico anterior.
- [x] **Colores personalizables por negocio**: además de fondo y texto
      (que ya existían), ahora cada negocio puede elegir el color de sus
      botones y el color del texto de esos botones, desde Ajustes — y
      se aplica en las 3 páginas públicas (`/menu`, `/book`, `/link`) a
      todos los CTA (Ver menú, Continuar, Confirmar, Dejar reseña,
      Llamar, cada link del Smartlink).
- [x] **Imagen de fondo para Smartlink**: reutiliza el mismo campo de
      "foto principal" de Ajustes (con la etiqueta adaptada según el
      tipo de negocio), pero en Smartlink se muestra como fondo de toda
      la página con un overlay oscuro para que el texto siga siendo
      legible sobre cualquier foto.
- [x] **Selector de idioma en la landing** (`EN`/`ES` en el header,
      inglés por defecto) — diccionario completo de traducciones en
      `lib/i18n-landing.ts`. *Nota: esto cubre solo la landing pública;
      el dashboard, login y signup siguen en español únicamente — hacer
      toda la app bilingüe sería un proyecto aparte.*
- [x] **Footer en los 3 dashboards**: logo de Zertoo + copyright, en el
      layout compartido (`app/dashboard/layout.tsx`), así que aparece
      automáticamente en Menú, Citas y Smartlink sin duplicar código.
- [x] **Verificación de correo por código al registrarse**: al hacer
      signup, se genera un código de 6 dígitos que expira en 15 minutos
      y se manda por correo (ver `lib/email.ts`). Mientras el correo no
      esté verificado, el layout del dashboard redirige a
      `/verify-email` — no se puede usar la plataforma sin verificar.
      **Importante**: sin `RESEND_API_KEY` configurada, el código se
      imprime en los logs del servidor en vez de enviarse por correo de
      verdad (ver la nota en `.env.example`) — esto mantiene el flujo
      usable para probar, pero antes de lanzar con usuarios reales hay
      que configurar esa variable. Las cuentas creadas *antes* de este
      cambio no se ven afectadas (quedan marcadas como verificadas por
      default, para no bloquear accesos existentes).
- [x] **Título de pestaña dinámico** (`Zertoo | Nombre del negocio`) en
      los 3 dashboards y en las 3 páginas públicas (`/menu`, `/book`,
      `/link`), vía `generateMetadata` de Next.js.
- [x] **Logo de Zertoo en el footer de las páginas públicas**: pequeño,
      centrado, semi-transparente, en `/menu`, `/book` y `/link`. En
      Smartlink se invierte a blanco automáticamente cuando el negocio
      tiene una foto de fondo (para que siga siendo visible).
- [x] **vCard descargable en Smartlink**: nuevo tipo de link "Guardar
      contacto" — al tocarlo, descarga un `.vcf` armado con el nombre,
      teléfono, correo y dirección configurados en Ajustes. No requiere
      llenar ningún campo extra al crearlo.
- [x] **Analíticas básicas en los 3 módulos**: tabla `PageView` que
      registra cada visita a `/menu`, `/book` y `/link`. Los 3
      dashboards muestran vistas de los últimos 7 días; Menú y Citas
      también muestran el rating promedio real (antes decían "—");
      Smartlink muestra clics totales y por link individual (cada link
      pasa por `/api/smartlink-items/[id]/go`, que cuenta el clic y
      redirige — así funciona sin JavaScript).
- [x] **Los 3 dashboards son responsive**: la sidebar fija de escritorio
      se convierte en una barra superior con menú hamburguesa en mobile
      (`components/dashboard-shell.tsx`); las cards de estadísticas
      apilan en una columna en pantallas angostas; las filas de platos,
      citas y links se reorganizan para no desbordarse (la info
      principal queda en un grupo, los precios/badges/acciones en otro
      que puede pasar a una segunda línea si no cabe).

## Panel de administración (`/admin`)

Completamente separado de las cuentas de tus clientes — tu propio login,
tu propia cookie de sesión, sin ninguna relación con `User`/`Tenant`.

**Crear tu primer usuario admin** (no hay signup público, a propósito):

```bash
npx tsx prisma/create-admin.ts "tu@correo.com" "tu-contraseña" "Tu Nombre"
```

En producción, corre ese mismo comando contra la base de Railway:

```bash
railway run npx tsx prisma/create-admin.ts "tu@correo.com" "tu-contraseña" "Tu Nombre"
```

Luego entra en `/admin/login`.

**Qué incluye:**
- `/admin` — resumen: negocios totales, nuevos últimos 7/30 días,
  desglose por tipo de negocio y por estado de suscripción, últimos
  registrados
- `/admin/tenants` — lista de todos los negocios, con búsqueda por
  nombre/slug y filtro por tipo
- `/admin/tenants/[id]` — detalle de un negocio: usuarios, contacto,
  **edición manual del plan y estado de suscripción** (útil mientras no
  esté conectado Stripe), conteos (platos/citas/links según el tipo), y
  botones para **suspender/reactivar** o **borrar por completo** la
  cuenta
- `/admin/activity` — log de las últimas 100 acciones hechas desde el
  panel (quién suspendió/reactivó/borró una cuenta o cambió un plan, y
  cuándo) — útil si en algún momento son varias personas con acceso al
  panel

**Suspender una cuenta** bloquea de inmediato el dashboard de ese
negocio (redirige a `/suspended`) — no borra nada, se puede revertir.
**Borrar una cuenta** es permanente y elimina todo lo asociado (usuarios,
platos, citas, links, reseñas) porque todas las relaciones del schema
usan `onDelete: Cascade` desde `Tenant`.

## Qué falta (siguiente iteración)

- [ ] **Configurar Resend de verdad** antes de tener usuarios reales —
      ahora mismo el código de verificación solo se ve en los logs del
      servidor si no se configura `RESEND_API_KEY`.

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
- [ ] Tests automatizados de los endpoints de API
- [ ] Reemplazar los estilos inline por Tailwind/componentes reutilizables
      — están así para que cada archivo sea legible de un vistazo

## Módulos escalables por negocio

Un negocio ya no está "encajonado" en un solo tipo. `Tenant.businessType`
sigue existiendo (es el módulo con el que empezó, se usa en el signup),
pero el acceso real a cada dashboard y página pública se decide con
`Tenant.enabledModules` (un array) — así un restaurante puede activar
Smartlink más adelante, o un Smartlink puede agregar Citas, sin perder
nada de lo que ya tenía.

- **`/dashboard/modules`** — nueva página donde el dueño activa/desactiva
  cada módulo. Siempre debe quedar al menos uno activo.
- **Desactivar no borra nada** — un módulo apagado deja de aparecer en
  el nav y su página pública devuelve 404, pero sus datos (platos,
  citas, links) siguen en la base por si lo reactivan.
- **`lib/modules.ts`** centraliza toda esta lógica (`getEnabledModules`,
  rutas de cada módulo) — es el único lugar que hay que tocar si se
  agrega un cuarto módulo en el futuro.
- **Compatibilidad con cuentas viejas**: si `enabledModules` está vacío
  (cuentas creadas antes de este cambio), `getEnabledModules()` cae de
  vuelta a `businessType` — ninguna cuenta existente pierde acceso a lo
  que ya tenía, sin necesitar una migración de datos manual.

**Simplificación conocida**: el resumen de `/admin` (desglose "por tipo
de negocio") sigue agrupando por `businessType` (el módulo inicial), no
por todos los módulos activos de cada uno — así que un negocio con
Menú + Smartlink solo cuenta una vez, en la categoría de su módulo
original. Es una simplificación aceptable para una vista general, pero
si te importa el conteo exacto por módulo, se puede ajustar.

## FAQ tipo chat (sin IA) en los 3 módulos

Opción sin costo variable, pensada como primer paso antes de evaluar un
chatbot con IA real (que sí tendría costo por mensaje). El negocio
escribe preguntas y respuestas fijas desde **`/dashboard/faqs`**
(reordenables con flechas arriba/abajo, igual patrón que otras listas
del dashboard), y aparecen como un ícono de chat flotante en sus 3
páginas públicas (`/menu`, `/book`, `/link`) — el cliente toca el
ícono, ve la lista de preguntas, toca una y aparece la respuesta ahí
mismo, simulando una conversación sin que haya ningún modelo de
lenguaje de por medio.

- Modelo nuevo: `FaqItem` (tenantId, question, answer, sortOrder).
- `GET /api/public/faqs?slug=X` — público, sin autenticación, lo usa
  `components/faq-chat-widget.tsx`.
- El ícono se posiciona **abajo a la izquierda** a propósito, para no
  chocar con el botón de "Llamar" que el menú público ya tiene abajo a
  la derecha.
- Si el negocio no configuró ninguna pregunta, el ícono no aparece —
  nunca se muestra un chat vacío.
- **Nota**: esta página del dashboard (`/dashboard/faqs`) todavía no
  está traducida al inglés (queda en español fijo) — mismo caso que
  otras piezas nuevas que se agregan después del sistema de traducción
  de dashboards.

## Recuperar contraseña olvidada

Faltaba desde el principio — flujo estándar con link de un solo uso
por correo (no un código a escribir, mismo criterio que usa cualquier
plataforma seria para esto):

- **`/forgot-password`** — el usuario escribe su correo. La respuesta
  es **siempre la misma** exista o no esa cuenta (`{ok:true}`), para no
  filtrarle a nadie qué correos están registrados en la plataforma —
  mismo criterio que ya usaba el login con "correo o contraseña
  incorrectos" en vez de decir cuál de los dos falló.
- Si el correo existe, se genera un **token largo y aleatorio**
  (`crypto.randomBytes`, no un código corto de 6 dígitos — es una
  acción más sensible que verificar un correo, así que el link es más
  difícil de adivinar), válido por **1 hora**, y se manda por correo.
- **`/reset-password?token=...`** — el usuario elige su nueva
  contraseña. El token se invalida apenas se usa una vez (no sirve de
  nuevo si alguien vuelve a abrir el mismo link), y lo deja con la
  sesión iniciada de una vez, sin tener que pasar por el login después.
- Mismo *cooldown* de 30 segundos entre pedidos que ya usaba el
  reenvío del código de verificación de correo, para no facilitar spam.
- Las traducciones (EN/ES) se agregaron a `lib/i18n-auth.ts`, mismo
  sistema que ya usaba el login — el idioma se hereda de lo que la
  persona eligió en la landing, no hay un selector nuevo.

## Pedidos desde el menú (pickup / delivery, sin pago online)

Decisión de alcance consciente: el cliente arma su pedido y lo manda,
pero **paga al retirar o recibir** (efectivo o como ya cobre el
negocio hoy) — no hay pasarela de pago online todavía. Se evaluó y
descartó Stripe Connect para esta primera versión (ver discusión sobre
por qué NO conviene rutear el dinero de terceros por la cuenta propia
de Stripe de la plataforma) — queda documentado como el camino a seguir
el día que se quiera agregar cobro real.

- **Pickup y delivery se activan por separado** — no todo negocio
  ofrece ambos. Configurable desde `/dashboard/orders`: activar
  pedidos, cuál de los dos (o ambos), costo de envío, y pedido mínimo
  para delivery.
- **Carrito en el menú público** — un botón "+" junto a cada plato
  (solo visible si el negocio activó pedidos y el plato no está
  agotado), con una barra flotante abajo mostrando el total, que abre
  el checkout.
- **Los precios se recalculan siempre en el servidor** desde la base de
  datos al confirmar el pedido — nunca se confía en lo que mande el
  navegador, para que nadie pueda manipular el precio final.
- **Dashboard** (`/dashboard/orders`) — pedidos activos vs. historial,
  con botones para avanzar el estado (Confirmar → Marcar listo →
  Completar) o cancelar.
- Cada pedido también alimenta el **CRM de clientes** (`fromOrder`), y
  el cliente recibe un correo de confirmación con el detalle.

## CRM unificado de clientes + campañas de admin

El vacío que señalaste: hasta ahora, los datos de cada cliente vivían
aislados en cada módulo (una cita acá, una reseña allá) sin nada que
los uniera como "esta misma persona", ni forma de que tú (como admin
de Zertoo) vieras clientes más allá de un solo negocio.

- **Modelo nuevo `Customer`** — un registro por correo, por negocio,
  alimentado automáticamente por `lib/customers.ts` desde 3 puntos:
  toda cita (pública o manual), reseñas cuando el cliente sí deja su
  correo (ahora es un campo opcional nuevo en el formulario público de
  reseñas — antes no se pedía en absoluto), y el premio del menú.
- **Dashboard del negocio** (`/dashboard/customers`) — cada negocio ve
  y exporta a CSV solo sus propios clientes.
- **Admin de Zertoo** (`/admin/customers`) — mismo listado pero de
  **todos** los negocios juntos, con buscador y exportar CSV.
- **Campañas** (`/admin/campaigns`) — arma y manda una campaña de
  correo (asunto + cuerpo libre) o de WhatsApp (plantilla de Marketing
  aprobada + una variable de texto), filtrando por un negocio específico
  o todos a la vez. Cada envío queda registrado en `CampaignLog`.
- **Baja obligatoria** — cada correo de campaña incluye un link de
  "Darme de baja" (`/unsubscribe`) que marca `Customer.unsubscribed` —
  a partir de ahí, esa persona queda excluida de toda campaña futura
  automáticamente, sin que nadie tenga que acordarse de filtrarla a mano.

**Dos advertencias que dejé bien visibles en el código y en la propia
pantalla de campañas, no solo acá:**
1. Estos clientes dejaron sus datos para un propósito puntual (reservar,
   reseñar, reclamar un premio) — no para recibir marketing. Mandar
   campañas no solicitadas puede pisar leyes de spam según la
   jurisdicción, y las plantillas de WhatsApp de categoría Marketing
   tienen reglas de consentimiento más estrictas que las de Utility que
   usamos para recordatorios — mal uso puede llevar a que Meta suspenda
   la cuenta de WhatsApp Business de la plataforma entera, afectando a
   todos los negocios que dependen de ella.
2. El envío de campañas es **síncrono** (una sola petición HTTP,
   limitada a 500 destinatarios por envío como techo de seguridad) —
   funciona bien para el tamaño actual de la plataforma, pero si la
   base de clientes crece mucho, esto habría que rediseñarlo como un
   trabajo en segundo plano para no toparse con límites de tiempo de
   una sola petición.

## "Premio en el menú" — captura de datos + código por WhatsApp (solo Restaurantes)

Versión del programa de fidelidad pensada para Menú, donde no existe el
concepto de "cita confirmada" que usa el programa de sellos de Citas.
Acá la mecánica es de una sola vez: un botón al final del menú público
(texto configurable, ej. "Postre gratis 🎁") invita al cliente a dejar
nombre, correo y WhatsApp a cambio de un premio — recibe un código de
6 caracteres por WhatsApp al instante para canjear en el local.

- **Modelo nuevo**: `MenuLead` (nombre, correo, WhatsApp, código, si ya
  se canjeó). El correo evita duplicados — si la misma persona vuelve a
  reclamar, le reenviamos su código existente en vez de crear uno nuevo.
- **Dashboard** (`/dashboard/menu-leads`, solo visible si el módulo de
  Restaurante está activo): activar/desactivar, texto del botón, texto
  del premio, y dos formas de canjear — buscando por código (lo más
  práctico en el mostrador) o desde la lista completa.
- **Segunda plantilla de WhatsApp**: esta función necesita su propia
  plantilla aprobada por Meta (`menu_lead_reward`), separada de la de
  recordatorios de citas — `lib/whatsapp.ts` ahora tiene una función
  base compartida (`sendTemplateMessage`) que ambas funciones usan por
  dentro. Instrucciones completas en `.env.example`.

## Programa de sellos/fidelidad

Segundo diferencial "de negocio" — sin costo, sin app nueva, usa el
correo que ya se captura al reservar. Cada vez que una cita se
confirma (manual o desde la reserva pública), el cliente (identificado
por su correo, normalizado en minúsculas para que coincida siempre)
suma un sello en `LoyaltyCard`. Al llegar a la cantidad configurada
(por defecto 6), se le manda un correo avisándole que ganó el premio.

- **Dashboard** (`/dashboard/loyalty`) — activar/desactivar, elegir
  cuántas visitas hacen falta y el texto del premio, y ver la lista de
  clientes con sus sellos. Cuando un cliente reclama el premio en
  persona, el negocio hace clic en "Marcar premio canjeado" — le resta
  las visitas usadas (sin perder el sobrante si tenía de más) y suma al
  historial de premios canjeados.
- **Página pública** (`/loyalty/[slug]`) — el cliente escribe su correo
  y ve cuántos sellos lleva, sin necesidad de cuenta ni contraseña.
- **Alcance actual**: el sello se suma al **confirmar** la cita (no al
  completarla) — es la señal más simple que ya existe en el sistema.
  Si más adelante se agrega una forma de marcar una cita como
  "completada" después de que en verdad ocurrió, sería más preciso
  mover el disparador ahí; por ahora esto ya funciona y no requería
  construir esa pieza nueva primero.

## Recordatorios de citas por WhatsApp

Primer diferencial "de negocio" que agregamos (no solo funcionalidad):
reduce las ausencias a citas — el dolor #1 de cualquier negocio de
citas — avisando al cliente por WhatsApp antes de su hora, además del
correo de confirmación que ya mandábamos.

**Idioma por cita**: la página pública de citas ahora tiene un
selector ES/EN (arriba a la derecha de la pantalla principal, mismo
patrón de `localStorage` que el resto del sitio) — lo que el cliente
elige ahí queda guardado en `Booking.language`, y el recordatorio le
llega en ese idioma, usando la variante correspondiente de la
plantilla de WhatsApp (Meta permite tener la misma plantilla aprobada
en varios idiomas a la vez). **Nota de alcance**: el selector cambia
el idioma del recordatorio; el resto del texto de esa página pública
(los pasos, botones, etc.) todavía está fijo en español — traducir esa
página por completo sería una tarea aparte, similar a la que hicimos
con los dashboards.

- **`lib/whatsapp.ts`** — llamadas directas a la API oficial de Meta
  (WhatsApp Cloud API), sin SDK. Como WhatsApp exige una plantilla
  aprobada por Meta para mensajes que el negocio inicia (no se puede
  mandar texto libre para esto), la plantilla se configura una vez en
  Meta Business Manager — instrucciones completas en `.env.example`.
- **`POST /api/cron/send-booking-reminders`** — revisa, por cada
  negocio con recordatorios activos, qué citas confirmadas caen dentro
  de su ventana configurada (por defecto 24h antes) y todavía no
  recibieron el recordatorio (`Booking.reminderSentAt`), y lo manda.
  Protegido con un secreto (`CRON_SECRET`) — **este endpoint necesita
  que algo externo lo llame periódicamente** (cron-job.org gratis, o
  Railway Cron Schedules) — Next.js no corre nada en segundo plano por
  su cuenta, instrucciones también en `.env.example`.
- **Dashboard** (`/dashboard/bookings` → Integraciones): cada negocio
  puede activar/desactivar los recordatorios y elegir cuántas horas
  antes avisar — activado por defecto (24h antes).

**Igual que las demás integraciones — esto no manda nada todavía sin
credenciales reales.** Sin `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`
configurados, el toggle del dashboard muestra un aviso claro, y sin el
cron externo llamando al endpoint, simplemente nunca se dispara —
ninguno de los dos casos rompe nada más de la plataforma.

## Facturación real con Stripe (por módulo)

Antes, los planes solo se podían asignar a mano desde `/admin` — ahora
hay un flujo de cobro real, diseñado a propósito para calzar con el
sistema de módulos escalables: **cada módulo activo (Menú, Citas,
Smartlink) es su propio ítem dentro de una sola suscripción de
Stripe**, así que un negocio con dos módulos activos paga la suma de
ambos, no un plan fijo de "todo o nada".

Precios actuales (ajustables en `lib/modules.ts` → `MODULE_PRICES`,
pero también hay que actualizarlos en Stripe para que coincidan):
Smartlink $12.90, Citas $29.90, Menú $39.90 — todos mensuales.

**Piezas nuevas:**
- `lib/stripe.ts` — cliente de Stripe, `getOrCreateStripeCustomer()`,
  mapeo de status de Stripe a nuestro campo simple, y
  `PRICE_ID_BY_MODULE` (lee los Price IDs desde variables de entorno).
- `POST /api/billing/checkout` — arma el checkout con un ítem por cada
  módulo que el negocio tiene activo *en ese momento*, y redirige a la
  página de pago de Stripe.
- `POST /api/billing/portal` — redirige al portal de Stripe donde el
  negocio cambia su tarjeta, ve facturas, o cancela por su cuenta.
- `POST /api/webhooks/stripe` — el corazón de la sincronización: reacciona
  a `checkout.session.completed`, `customer.subscription.updated/created/
  deleted`, e `invoice.payment_failed`, y mantiene nuestra tabla
  `Subscription` (+ `SubscriptionModuleItem`, que guarda qué módulo
  corresponde a qué ítem real de Stripe) al día con lo que Stripe dice.
- **`/dashboard/billing`** — nueva página: muestra el estado
  (prueba/activa/pago atrasado/cancelada), el desglose de precio por
  módulo activo, el total mensual, y el botón "Suscribirse" o
  "Gestionar facturación" según corresponda.
- **Activar/desactivar un módulo en `/dashboard/modules` ahora también
  actualiza la suscripción de Stripe** (si ya existe una) — agrega o
  quita ese ítem de lo que se está cobrando, sin que el negocio tenga
  que hacer nada aparte.

**Esto no cobra nada todavía sin configurar credenciales reales** —
mismo patrón que Resend, Google Calendar y R2. Los pasos completos
(crear los 3 Products/Prices en Stripe, configurar el webhook, y qué
eventos escuchar) están en `.env.example`. Mientras no esté
configurado, `/dashboard/billing` muestra un aviso claro, y el plan
sigue pudiéndose asignar manualmente desde `/admin/tenants/[id]` como
hasta ahora — ese camino manual nunca se quitó, sigue funcionando en
paralelo para casos especiales (cortesías, acuerdos manuales, etc).

## Storage de imágenes en S3/R2 (reemplaza el base64 en la base de datos)

Hasta ahora, cada foto (plato, servicio, logo, foto de fondo) se
guardaba como texto base64 directo en la columna `imageUrl` — funcionaba,
pero hacía crecer la base de datos rápido y cada consulta que tocara
esas filas movía mucho más dato del necesario. Ahora:

- **`lib/s3.ts`** — cliente de S3 (usando `@aws-sdk/client-s3`, funciona
  igual para AWS S3 real o Cloudflare R2, que es compatible con la
  misma API) + `createPresignedUpload()`, que genera una URL de subida
  firmada, válida 5 minutos.
- **`POST /api/uploads/presign`** — el navegador pide esa URL firmada
  (autenticado, cada negocio solo puede subir a su propia carpeta
  dentro del bucket: `{tenantId}/archivo.jpg`).
- **`lib/upload-image.ts`** — el helper de cliente que junta todo:
  redimensiona la foto en el navegador (canvas, igual que antes), pide
  la URL firmada, y sube el archivo **directo al bucket** — ya no pasa
  por nuestro servidor, así que no consume ancho de banda de Railway ni
  demora por eso.
- Reemplazado en los 3 lugares que subían fotos: platos (Menú),
  servicios (Citas), logo y foto de fondo (Ajustes, usado por los 3
  módulos).

**Esto no funciona todavía sin configurar credenciales reales** — mismo
patrón que Resend y Google Calendar. Sin eso, subir una foto da un
error claro ("El almacenamiento de imágenes todavía no está
configurado") en vez de fallar en silencio o romper algo más. Los pasos
completos para configurar **tanto Cloudflare R2 como AWS S3** (con cuál
elegir y por qué) están en `.env.example`, incluyendo el CORS que hay
que configurar en el bucket para que el navegador pueda subir directo.

**Importante sobre las fotos que ya subiste antes de este cambio**:
siguen funcionando exactamente igual (siguen siendo base64 en la base de
datos, un navegador las muestra sin problema) — **no se migraron
automáticamente a S3**. Si quieres moverlas también, sería un script
aparte (leer cada `imageUrl` que empiece con `data:`, subirlo a S3,
actualizar la fila) — no lo hicimos en este cambio, avisa si lo quieres.

## Fix visual: inputs desbordados en pares Fecha/Hora

El componente `Field` compartido (usado en los pares "Fecha/Hora" y
"Desde/Hasta" de los modales de Citas y en Ajustes) le faltaba
`min-w-0`. Sin eso, un input nativo (`type="date"`/`type="time"`)
imponía su ancho mínimo de contenido y el flexbox no lo dejaba
encogerse — así que en pantallas angostas el segundo campo del par se
desbordaba hacia la derecha, fuera del modal. Corregido en
`bookings-view.tsx` y `settings-form.tsx`. También unifiqué el ancho y
padding del formulario público de citas (`booking-flow.tsx`), que antes
saltaba de tamaño entre la lista de servicios y el paso de fecha/hora.

## Idioma EN/ES en los 3 dashboards, y AWG

Switch ES/EN en la sidebar (desktop) y la barra superior (mobile) del
dashboard — usa `components/dashboard-shell.tsx` + un React Context
(`lib/dashboard-lang-context.tsx`) para que cualquier página lo pueda
leer con el hook `useDashboardLang()`, sin tener que pasarlo por props
manualmente desde cada `page.tsx`. Mismo `localStorage` (`zertoo_lang`)
que ya usa la landing/login/signup — si alguien ya eligió inglés en
otra parte del sitio, el dashboard lo respeta desde el primer momento.

**Alcance de esta traducción, actualizado**: además de la navegación y
lo más visible de cada página (títulos, subtítulos, botones
principales, cards de estadísticas), ahora también están traducidos
**todos los modales de crear/editar** de los 3 módulos: platos y
categorías (Menú), servicios/citas/bloqueos (Citas), links (Smartlink),
y el link externo de reseñas — incluyendo sus mensajes de error, los
estados de cita (Pendiente/Confirmada/Cancelada/Completada), y los
nombres + textos de ayuda de cada tipo de link en Smartlink
(WhatsApp, Instagram, Maps, vCard, etc., antes fijos en español).

**Lo que sigue sin traducir** (no llegamos a esto todavía): el
contenido dinámico que el propio dueño escribe — nombres de categorías
y platos, nombres de servicios, textos de bloqueo, y similares — eso
nunca se traduce automáticamente, es texto libre del negocio, no de la
interfaz.

Se agregó **AWG (florín arubeño)** a las monedas soportadas
(`lib/currency.ts`, `app/api/tenant/settings/route.ts`) — ya aparece en
el selector de moneda de Ajustes.

## Integración con Google Calendar (Citas)

Cada negocio puede conectar su propio Google Calendar desde
`/dashboard/bookings` → sección "Integraciones". Una vez conectado,
**cada cita que se confirma se agrega automáticamente** a su calendario
— ya sea porque el dueño la confirma desde el dashboard, o porque la
crea directamente como manual (nace confirmada). Si una cita
sincronizada se cancela, el evento también se borra de Google.

Es **solo de salida** (Zertoo → Google) — no lee ni bloquea horarios en
base a lo que el dueño tenga en su Google Calendar personal. Si más
adelante hace falta la sincronización en ambos sentidos, es una
extensión bastante más grande (necesitaría webhooks de Google o
revisiones periódicas, y que `lib/availability.ts` también considere
esos eventos externos como ocupado).

**Piezas nuevas:**
- `lib/google-calendar.ts` — todo el flujo OAuth (armar el link de
  autorización, intercambiar el código por tokens, refrescar el access
  token cuando expira) y las dos funciones que importan:
  `syncBookingToGoogleCalendar()` y `deleteGoogleCalendarEvent()`.
- `GoogleCalendarConnection` — modelo nuevo, uno por negocio, guarda
  los tokens.
- `Booking.googleEventId` — para poder borrar el evento correcto si la
  cita se cancela.
- 4 endpoints bajo `/api/integrations/google-calendar/`: `connect`
  (inicia el OAuth), `callback` (Google vuelve acá), `status` (para que
  el dashboard sepa si ya está conectado), `disconnect`.

**Importante — esto no funciona solo, hay que configurarlo**: como con
Resend, hasta que no crees credenciales reales en Google Cloud Console
y las pongas en las variables de entorno (`GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` — instrucciones paso a
paso en `.env.example`), el botón "Conectar" va a mostrar un aviso de
que la integración no está disponible todavía. El resto de la
plataforma sigue funcionando normal mientras tanto.

## Links a plataformas externas de reseñas

Desde `/dashboard/reviews` (que de paso pasé a tema claro — se había
quedado con las clases oscuras viejas de antes del rebranding), el
negocio puede agregar links a Google, TripAdvisor, Yelp, Facebook, u
"Otro" (cualquier URL), cada uno con su propio **activar/desactivar**
sin perder la configuración guardada. Se muestran en
`/review/[slug]`, arriba del formulario de reseña interno, con un
separador ("o déjanos tu reseña aquí"). Modelo nuevo:
`ExternalReviewLink` (tenantId, platform, label, url, enabled,
sortOrder).

## Sistema de disponibilidad y calendario de Citas

Antes, los horarios que veía el cliente en `/book/[slug]` eran fijos
(4 días, 6 horas por día, sin importar si el negocio estaba abierto o
si ya había otra cita ahí). Ahora hay un motor de disponibilidad real:

- **`lib/availability.ts`** — el núcleo: `getBusinessHours()` (con
  default L-S 9-18, domingo cerrado, para negocios que no lo
  configuraron), `getAvailableSlots()` (calcula horarios libres para un
  servicio + fecha, respetando horario de atención, citas existentes,
  bloqueos, y el buffer entre citas), `isSlotFree()` (verifica un
  horario puntual — lo usan los dos endpoints que crean citas, público
  y manual, reemplazando la lógica de conflicto ad-hoc que tenían
  antes).
- **`Tenant.bufferMinutes`** (default 15) — minutos de colchón después
  de cada cita antes de que se pueda reservar la siguiente. Configurable
  desde el dashboard.
- **`BusinessHours`** — modelo nuevo, hasta 7 filas por negocio (una
  por día de semana), con apertura/cierre y abierto/cerrado.

**Dashboard (`/dashboard/bookings`):**
- **"Horario de atención"** — nueva sección: cada día de la semana con
  su toggle abierto/cerrado y horas, más el campo de minutos de buffer.
- **"Agenda"** — reemplaza la lista plana de "solo hoy" que había
  antes. Ahora es una vista de calendario por día, con navegación
  ← día → , que muestra cada franja de tiempo (cada 30 min dentro del
  horario de atención) como: una cita existente (con botones
  Confirmar/Cancelar ahí mismo), un bloqueo, o libre — y **tocar un
  espacio libre abre "Nueva cita" con esa fecha/hora ya precargada**.

**Cliente (`/book/[slug]`):** el paso de fecha/hora ahora es un
`<input type="date">` real (selector de fecha nativo) en vez de 4
pastillas fijas; al elegir la fecha, se piden en vivo los horarios
libres de verdad para ese servicio ese día (`GET
/api/public/availability`), con estado de carga y mensaje de "no hay
horarios disponibles" si no hay ninguno.

## Módulo de Citas — reestructurado

Antes, el dashboard de Citas nunca tuvo una forma real de crear/editar
**servicios** (solo existían por el seed de pruebas) — el único botón de
"crear" que existía era "Nueva cita" (una reserva manual), lo cual
confundía. Ahora:

- **`/dashboard/bookings`** tiene una sección nueva "Tus servicios"
  arriba de la agenda: crear/editar/borrar servicios, cada uno con foto
  opcional (mismo patrón de redimensionado que el menú), descripción,
  duración y precio. El borrado se bloquea si el servicio ya tiene citas
  asociadas (protección igual que categorías del menú).
- **`Service.description` y `Service.imageUrl`** son campos nuevos en
  el schema.

**Página pública `/book/[slug]` — rediseñada de raíz:**
- Ya no arranca directo en "elige un servicio" dentro del wizard — ahora
  es una pantalla de perfil (foto circular como Smartlink, foto de
  fondo opcional con overlay, nombre, descripción corta) con el título
  "Agendar cita", y los servicios se muestran como una lista (con o sin
  foto según si el negocio subió una) — igual que pediste.
- Al tocar un servicio, entra directo al flujo de fecha/hora + datos del
  cliente (el mismo wizard que ya existía, ahora con "← Volver a
  servicios" en vez de un paso 1 de selección redundante).
- **Pie con los datos de contacto** (teléfono, correo, dirección) —
  mismo patrón que ya usa `/menu/[slug]`.
- Foto de perfil y fondo reutilizan los mismos campos que ya existían
  (`logoUrl`, `heroImageUrl`) — no hubo que agregar campos nuevos para
  eso, ya estaban en el modelo.

**Correo de confirmación de cita**: se envía (vía `lib/email.ts`,
mismo proveedor Resend) en el momento en que la cita pasa a estado
CONFIRMADA — ya sea porque el dueño la confirma desde el dashboard, o
porque la creó directamente como cita manual (que nace confirmada). No
se envía en el momento de la solicitud inicial (estado pendiente), para
que coincida con el mensaje que ya le mostramos al cliente
("...cuando el negocio confirme tu cita").

## Wishlist en el menú público

Corazón tocable en cada plato de la lista (izquierda) y en cada card de
Destacados (arriba a la derecha, junto al badge naranja). Vive
enteramente en el navegador del cliente vía `localStorage`
(`zertoo_wishlist_{slug}`, separado por negocio) — no requiere cuenta ni
login, y no toca la base de datos. El contador aparece junto al switch
ES/EN en la nav de categorías solo cuando hay al menos un favorito; al
tocarlo, filtra el menú para mostrar solo los platos marcados (se puede
volver a tocar para quitar el filtro).

**Fix relacionado**: el switch ES/EN estaba dentro del mismo contenedor
con scroll horizontal que las categorías — con varias categorías podía
quedar empujado fuera de la vista. Ahora vive en un contenedor aparte,
siempre visible. También cambié el idioma con el que arranca esta
página específicamente: en vez de heredar el default "en" pensado para
la landing, el menú arranca en español salvo que la persona ya haya
elegido inglés explícitamente antes en el sitio.

## Menú público bilingüe (EN/ES)

Toggle ES/EN en la barra de categorías de `/menu/[slug]`. **Solo se
traducen categorías y descripciones de platos — nunca el nombre del
plato** (puede ser cualquier cosa: una marca, un plato regional, un
nombre propio). Sin servicio de traducción automática de por medio: el
negocio escribe su propia versión en inglés desde el dashboard
(`MenuCategory.nameEn`, `MenuItem.descriptionEn`, ambos opcionales). Si
no se llenó la versión en inglés de algo, se muestra el original en
español — nunca queda un hueco vacío. El idioma elegido se guarda igual
que en la landing (`localStorage`, misma clave), así que si alguien
llegó desde la landing ya en inglés, el menú abre en inglés también.

## Fotos en la lista del menú (opcional, por negocio)

Por diseño, la lista completa del menú público muestra solo texto (sin
fotos) — solo la sección "Destacados" arriba tiene foto grande. Esto fue
una decisión deliberada basada en una referencia real de restaurante.

Si un negocio prefiere ver la foto de cada plato en toda la lista, puede
activarlo desde **Ajustes → "Mostrar la foto de cada plato en la lista
del menú"** (`Tenant.menuShowPhotos`, default `false`). Si el plato no
tiene foto subida, se muestra un placeholder gris del mismo tamaño en
vez de dejar el espacio vacío.

## Página pública de reseñas (`/review/[slug]`)

Funciona para cualquier tipo de negocio (no está atada a un módulo
específico). Selector de estrellas interactivo, nombre y comentario
opcional, usa los colores de marca del negocio igual que las otras 3
páginas públicas. Enlazada desde:
- `/menu/[slug]` — botón debajo de la lista de platos
- `/book/[slug]` — link en la pantalla de "Reserva enviada"
- `/link/[slug]` — link debajo de la lista de enlaces

## Stack

Next.js 14 · TypeScript · Prisma · PostgreSQL · Zod (validación) · bcryptjs +
JWT (auth propia, sin dependencias externas de auth) · Stripe (pendiente de
cablear) · Tailwind (para las páginas de UI que faltan)
