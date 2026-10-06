import { readFile } from "fs/promises";
import path from "path";
import satori from "satori";
import sharp from "sharp";
import { db } from "./db";

// Recibo del cliente (plantilla "recibo printer.pdf"): se arma como imagen
// en el servidor y el Print Bridge solo manda los bytes a la impresora —
// así el diseño respeta la plantilla, las tildes/ñ salen bien (ESC/POS en
// ASCII las rompe) y cambiar el diseño no requiere un build nuevo de la app.

// Papel de 80 mm a 203 dpi: 576 puntos útiles. Si la impresora real fuera de
// otro ancho, es la única constante a ajustar.
export const RECEIPT_WIDTH = 576;
const BYTES_PER_ROW = RECEIPT_WIDTH / 8;
const RECEIPT_TIMEZONE = process.env.RECEIPT_TIMEZONE || "America/Aruba";

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", AWG: "ƒ", EUR: "€", COP: "$", ARS: "$", MXN: "$" };

export interface ReceiptData {
  businessName: string;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  currencySymbol: string;
  orderCode: string;
  fulfillment: "PICKUP" | "DELIVERY" | "DINE_IN";
  tableName: string | null;
  waiterName: string | null;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string | null;
  items: { name: string; quantity: number; price: number; addOns: string[]; notes: string | null }[];
  total: number;
  payments: { method: "CASH" | "CARD"; amount: number; tendered: number | null }[];
  printedAt: Date;
}

export async function loadReceiptData(orderId: string, tenantId: string): Promise<ReceiptData | null> {
  const order = await db.menuOrder.findFirst({
    where: { id: orderId, tenantId },
    include: {
      items: { orderBy: { id: "asc" } },
      payments: { orderBy: { createdAt: "asc" } },
      waiter: { select: { name: true } },
      table: { select: { name: true } },
      tenant: { select: { name: true, address: true, contactPhone: true, logoUrl: true, currency: true } },
    },
  });
  if (!order) return null;

  return {
    businessName: order.tenant.name,
    address: order.tenant.address,
    phone: order.tenant.contactPhone,
    logoUrl: order.tenant.logoUrl,
    currencySymbol: CURRENCY_SYMBOL[order.tenant.currency] ?? `${order.tenant.currency} `,
    orderCode: order.id.slice(-5).toUpperCase(),
    fulfillment: order.fulfillment,
    tableName: order.table?.name ?? null,
    waiterName: order.waiter?.name ?? null,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    items: order.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      price: i.price,
      addOns: Array.isArray(i.addOns) ? (i.addOns as { name: string }[]).map((a) => a.name) : [],
      notes: i.notes,
    })),
    total: order.total,
    payments: order.payments.map((p) => ({ method: p.method, amount: p.amount, tendered: p.tendered })),
    printedAt: order.paidAt ?? new Date(),
  };
}

// --- fuentes (Poppins, OFL — satori las embebe como trazos, no depende de
// fuentes instaladas en el servidor) ---
let fontsPromise: Promise<{ name: string; data: Buffer; weight: 400 | 600 | 700; style: "normal" }[]> | null = null;
function loadFonts() {
  if (!fontsPromise) {
    const dir = path.join(process.cwd(), "assets", "fonts");
    fontsPromise = Promise.all(
      (
        [
          ["Poppins-Regular.ttf", 400],
          ["Poppins-SemiBold.ttf", 600],
          ["Poppins-Bold.ttf", 700],
        ] as const
      ).map(async ([file, weight]) => ({
        name: "Poppins",
        data: await readFile(path.join(dir, file)),
        weight,
        style: "normal" as const,
      }))
    );
  }
  return fontsPromise;
}

// --- logo: descarga + pasa a 1-bit con difuminado Floyd–Steinberg, que es
// lo que mejor conserva un logo a color en una térmica ---
async function logoDataUri(logoUrl: string): Promise<{ src: string; width: number; height: number } | null> {
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());
    const { data, info } = await sharp(input)
      .flatten({ background: "#ffffff" })
      .resize({ width: 300, height: 170, fit: "inside", withoutEnlargement: false })
      .grayscale()
      .normalise()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height } = info;
    const px = Float32Array.from(data);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const old = px[i];
        const next = old < 140 ? 0 : 255;
        px[i] = next;
        const err = old - next;
        if (x + 1 < width) px[i + 1] += (err * 7) / 16;
        if (y + 1 < height) {
          if (x > 0) px[i + width - 1] += (err * 3) / 16;
          px[i + width] += (err * 5) / 16;
          if (x + 1 < width) px[i + width + 1] += err / 16;
        }
      }
    }
    const png = await sharp(Buffer.from(Uint8Array.from(px, (v) => (v < 128 ? 0 : 255))), {
      raw: { width, height, channels: 1 },
    })
      .png()
      .toBuffer();
    return { src: `data:image/png;base64,${png.toString("base64")}`, width, height };
  } catch {
    // Mejor un recibo sin logo que ninguno.
    return null;
  }
}

// --- formato ---
const money = (symbol: string, n: number) => `${symbol}${n.toFixed(2)}`;

function formatDate(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: RECEIPT_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const h24 = Number(parts.hour);
  const period = h24 >= 12 ? "p.m." : "a.m.";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${parts.day}-${parts.month}-${parts.year}, ${h12}:${parts.minute} ${period}`;
}

// --- árbol de satori (objetos planos, sin JSX) ---
type Style = Record<string, string | number>;
type Node = { type: string; props: { style?: Style; children?: unknown; [k: string]: unknown } };
const el = (type: string, style: Style, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style, children, ...extra },
});
const text = (value: string, style: Style) => el("div", { display: "flex", ...style }, value);
const row = (left: unknown, right: unknown, style: Style = {}) =>
  el("div", { display: "flex", justifyContent: "space-between", alignItems: "flex-start", ...style }, [left, right]);
const divider = () => el("div", { display: "flex", height: 2, backgroundColor: "#000", marginTop: 12, marginBottom: 12 });

function buildTree(d: ReceiptData, logo: { src: string; width: number; height: number } | null): Node {
  const sym = d.currencySymbol;
  const isDineIn = d.fulfillment === "DINE_IN";
  const typeLabel = isDineIn ? d.tableName ?? "Mesa" : d.fulfillment === "DELIVERY" ? "Delivery" : "Pickup";

  const who: Node[] = [];
  if (isDineIn) {
    if (d.waiterName) who.push(text(`Mesero: ${d.waiterName}`, { fontWeight: 600, fontSize: 24 }));
  } else {
    who.push(text(`Cliente: ${d.customerName}`, { fontWeight: 600, fontSize: 24 }));
    if (d.customerPhone) who.push(text(d.customerPhone, { fontSize: 21 }));
    if (d.fulfillment === "DELIVERY" && d.deliveryAddress) who.push(text(d.deliveryAddress, { fontSize: 21 }));
  }

  const items = d.items.map((i) =>
    el("div", { display: "flex", flexDirection: "column", marginTop: 10 }, [
      row(
        text(`${i.quantity}× ${i.name}`, { fontWeight: 600, fontSize: 26, flex: 1, paddingRight: 12 }),
        text(money(sym, i.price * i.quantity), { fontWeight: 600, fontSize: 26 })
      ),
      ...i.addOns.map((a) => text(`+ ${a}`, { fontSize: 22, paddingLeft: 8 })),
      ...(i.notes ? [text(`“${i.notes}”`, { fontSize: 21, paddingLeft: 8, fontStyle: "italic" })] : []),
    ])
  );

  const paymentRows: Node[] = [];
  for (const p of d.payments) {
    if (p.method === "CARD") {
      paymentRows.push(row(text("Tarjeta", { fontSize: 24 }), text(money(sym, p.amount), { fontSize: 24 })));
    } else {
      paymentRows.push(row(text("Efectivo", { fontSize: 24 }), text(money(sym, p.tendered ?? p.amount), { fontSize: 24 })));
      if (p.tendered && p.tendered > p.amount + 0.005) {
        paymentRows.push(row(text("Cambio", { fontSize: 24 }), text(money(sym, p.tendered - p.amount), { fontSize: 24 })));
      }
    }
  }

  return el(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      width: RECEIPT_WIDTH,
      padding: "24px 30px 20px 30px",
      backgroundColor: "#fff",
      color: "#000",
      fontFamily: "Poppins",
    },
    [
      ...(logo
        ? [el("div", { display: "flex", justifyContent: "center", marginBottom: 10 }, el("img", {}, undefined, { src: logo.src, width: logo.width, height: logo.height }))]
        : []),
      text(d.businessName, { fontWeight: 700, fontSize: 32, justifyContent: "center", textAlign: "center" }),
      ...(d.address ? [text(d.address, { fontSize: 22, justifyContent: "center", textAlign: "center" })] : []),
      text(typeLabel, { fontWeight: 700, fontSize: 32, justifyContent: "center", textAlign: "center", marginTop: 18, marginBottom: 14 }),
      ...(who.length ? [el("div", { display: "flex", flexDirection: "column" }, who)] : []),
      divider(),
      el("div", { display: "flex", flexDirection: "column" }, items),
      divider(),
      row(text("Total", { fontWeight: 700, fontSize: 30 }), text(money(sym, d.total), { fontWeight: 700, fontSize: 30 })),
      el("div", { display: "flex", flexDirection: "column", marginTop: 6 }, paymentRows),
      divider(),
      text(d.businessName, { fontWeight: 600, fontSize: 24, justifyContent: "center", textAlign: "center" }),
      ...(d.address || d.phone
        ? [text([d.address, d.phone].filter(Boolean).join(" · "), { fontSize: 19, justifyContent: "center", textAlign: "center" })]
        : []),
      row(text(formatDate(d.printedAt), { fontSize: 20 }), text(`#${d.orderCode}`, { fontSize: 20 }), { marginTop: 18 }),
    ]
  );
}

export interface ReceiptRaster {
  width: number;
  height: number;
  bytesPerRow: number;
  /** 1 bit por punto, 1 = negro, MSB primero — listo para `GS v 0`. */
  data: Buffer;
  /** PNG en blanco y negro (solo para previsualizar/depurar). */
  png: Buffer;
}

export async function renderReceipt(d: ReceiptData): Promise<ReceiptRaster> {
  const [fonts, logo] = await Promise.all([loadFonts(), d.logoUrl ? logoDataUri(d.logoUrl) : Promise.resolve(null)]);
  const svg = await satori(buildTree(d, logo) as never, { width: RECEIPT_WIDTH, fonts });

  const base = sharp(Buffer.from(svg)).flatten({ background: "#ffffff" }).grayscale().threshold(150);
  const { data: gray, info } = await base.clone().raw().toBuffer({ resolveWithObject: true });
  const png = await base.clone().png().toBuffer();

  const { width, height } = info;
  const packed = Buffer.alloc(BYTES_PER_ROW * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width && x < RECEIPT_WIDTH; x++) {
      if (gray[y * width + x] < 128) packed[y * BYTES_PER_ROW + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return { width, height, bytesPerRow: BYTES_PER_ROW, data: packed, png };
}
