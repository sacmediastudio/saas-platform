import { db } from "./db";

export type OrderPeriod = "day" | "week" | "month" | "year" | "custom";

export interface CustomRange {
  start: Date;
  end: Date;
}

interface Bucket {
  start: Date;
  end: Date;
  label: string;
}

interface BucketResult {
  label: string;
  orders: number;
  sales: number;
}

export interface OrderStatsResult {
  totalOrders: number;
  totalDeliveries: number;
  totalPickup: number;
  totalSales: number;
  changeOrdersPercent: number | null;
  changeSalesPercent: number | null;
  buckets: BucketResult[];
}

const DAY_NAMES_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_NAMES_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Rango máximo para un período personalizado — generoso para lo que
// un negocio real querría revisar (más de un año de baldes diarios
// sería un gráfico ilegible, no una mejora).
const MAX_CUSTOM_RANGE_DAYS = 366;

// Los baldes de "año" son meses de calendario reales (28-31 días cada
// uno), no un promedio fijo de milisegundos — si se usara un tamaño
// fijo, los bordes de cada mes quedarían desalineados de a poco y un
// pedido podría terminar en el balde vecino equivocado. Los de
// día/semana/mes sí pueden ser de tamaño fijo (hora/día), porque esos
// no varían.
function getBuckets(period: OrderPeriod, now: Date, customRange?: CustomRange): Bucket[] {
  const buckets: Bucket[] = [];

  if (period === "day") {
    for (let i = 23; i >= 0; i--) {
      const end = new Date(now.getTime() - i * 60 * 60 * 1000);
      const start = new Date(end.getTime() - 60 * 60 * 1000);
      buckets.push({ start, end, label: `${start.getHours()}h` });
    }
  } else if (period === "week") {
    for (let i = 6; i >= 0; i--) {
      const end = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      buckets.push({ start, end, label: DAY_NAMES_ES[end.getDay()] });
    }
  } else if (period === "month") {
    for (let i = 29; i >= 0; i--) {
      const end = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      buckets.push({ start, end, label: String(end.getDate()) });
    }
  } else if (period === "year") {
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      buckets.push({ start, end, label: MONTH_NAMES_ES[start.getMonth()] });
    }
  } else {
    // "custom": un día puntual (start === end) se abre por hora, igual
    // que "day" — un rango de varios días se abre por día, igual que
    // "month", pero anclado a las fechas elegidas en vez de a "hoy".
    if (!customRange) throw new Error("Falta el rango de fechas para el período personalizado");
    const dayMs = 24 * 60 * 60 * 1000;
    const rangeStart = startOfDay(customRange.start);
    const rangeEndExclusive = new Date(startOfDay(customRange.end).getTime() + dayMs);
    const totalDays = Math.min(
      Math.max(Math.round((rangeEndExclusive.getTime() - rangeStart.getTime()) / dayMs), 1),
      MAX_CUSTOM_RANGE_DAYS
    );

    if (totalDays === 1) {
      for (let h = 0; h < 24; h++) {
        const start = new Date(rangeStart.getTime() + h * 60 * 60 * 1000);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        buckets.push({ start, end, label: `${h}h` });
      }
    } else {
      for (let i = 0; i < totalDays; i++) {
        const start = new Date(rangeStart.getTime() + i * dayMs);
        const end = new Date(start.getTime() + dayMs);
        buckets.push({ start, end, label: `${start.getDate()} ${MONTH_NAMES_ES[start.getMonth()]}` });
      }
    }
  }

  return buckets;
}

export async function getOrderStats(
  tenantId: string,
  period: OrderPeriod,
  customRange?: CustomRange
): Promise<OrderStatsResult> {
  const now = new Date();
  const buckets = getBuckets(period, now, customRange);
  const rangeStart = buckets[0].start;
  const rangeEnd = buckets[buckets.length - 1].end;

  // Para poder mostrar "↑ 12% esta semana", se compara contra un
  // tramo previo de exactamente el mismo largo — mismo criterio que
  // ya usa getViewsTrend() para las vistas de página. Se ancla al
  // final REAL del rango (rangeEnd), no a "now" — un período
  // personalizado en el pasado no debería compararse contra hoy.
  const rangeLengthMs = rangeEnd.getTime() - rangeStart.getTime();
  const previousRangeStart = new Date(rangeStart.getTime() - rangeLengthMs);

  const [currentOrders, previousOrders] = await Promise.all([
    db.menuOrder.findMany({
      where: { tenantId, createdAt: { gte: rangeStart, lt: rangeEnd } },
      select: { createdAt: true, total: true, fulfillment: true },
    }),
    db.menuOrder.findMany({
      where: { tenantId, createdAt: { gte: previousRangeStart, lt: rangeStart } },
      select: { total: true },
    }),
  ]);

  const bucketResults: BucketResult[] = buckets.map((b) => {
    const inBucket = currentOrders.filter((o) => o.createdAt >= b.start && o.createdAt < b.end);
    return {
      label: b.label,
      orders: inBucket.length,
      sales: Math.round(inBucket.reduce((sum, o) => sum + o.total, 0) * 100) / 100,
    };
  });

  const totalOrders = currentOrders.length;
  const totalDeliveries = currentOrders.filter((o) => o.fulfillment === "DELIVERY").length;
  const totalPickup = currentOrders.filter((o) => o.fulfillment === "PICKUP").length;
  const totalSales = Math.round(currentOrders.reduce((sum, o) => sum + o.total, 0) * 100) / 100;

  const previousTotalOrders = previousOrders.length;
  const previousTotalSales = previousOrders.reduce((sum, o) => sum + o.total, 0);

  const changeOrdersPercent =
    previousTotalOrders > 0 ? Math.round(((totalOrders - previousTotalOrders) / previousTotalOrders) * 100) : null;
  const changeSalesPercent =
    previousTotalSales > 0 ? Math.round(((totalSales - previousTotalSales) / previousTotalSales) * 100) : null;

  return {
    totalOrders,
    totalDeliveries,
    totalPickup,
    totalSales,
    changeOrdersPercent,
    changeSalesPercent,
    buckets: bucketResults,
  };
}
