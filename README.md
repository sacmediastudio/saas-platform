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
