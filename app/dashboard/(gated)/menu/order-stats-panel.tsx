"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useDashboardLang } from "@/lib/dashboard-lang-context";
import { formatCurrency } from "@/lib/currency";
import TrendStatCard from "@/components/trend-stat-card";

type Period = "day" | "week" | "month" | "year" | "custom";

// Fecha local en formato YYYY-MM-DD para <input type="date"> — evita el
// corrimiento de un día que da toISOString() cerca de medianoche, porque
// esta pasa primero por UTC.
function toDateInputValue(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

interface Bucket {
  label: string;
  orders: number;
  sales: number;
}

interface OrderStats {
  totalOrders: number;
  totalDeliveries: number;
  totalPickup: number;
  totalSales: number;
  changeOrdersPercent: number | null;
  changeSalesPercent: number | null;
  buckets: Bucket[];
}

export default function OrderStatsPanel({ currency }: { currency: string }) {
  const { t } = useDashboardLang();
  const [period, setPeriod] = useState<Period>("week");
  const [customStart, setCustomStart] = useState(() => toDateInputValue(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)));
  const [customEnd, setCustomEnd] = useState(() => toDateInputValue(new Date()));
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);

  const customRangeValid = customStart !== "" && customEnd !== "" && customStart <= customEnd;

  useEffect(() => {
    if (period === "custom" && !customRangeValid) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ period });
    if (period === "custom") {
      params.set("start", customStart);
      params.set("end", customEnd);
    }
    fetch(`/api/tenant/order-stats?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, customStart, customEnd, customRangeValid]);

  const periods: { value: Period; label: string }[] = [
    { value: "day", label: t.menu.orderStats.periodDay },
    { value: "week", label: t.menu.orderStats.periodWeek },
    { value: "month", label: t.menu.orderStats.periodMonth },
    { value: "year", label: t.menu.orderStats.periodYear },
    { value: "custom", label: t.menu.orderStats.periodCustom },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-bold">{t.menu.orderStats.title}</h2>
        <div className="flex gap-1 bg-[#F7F8F4] rounded-full p-0.5">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                period === p.value ? "bg-white shadow-sm" : "text-[#343233]/60"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {period === "custom" && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#343233]/70">{t.menu.orderStats.customFrom}</span>
            <input
              type="date"
              value={customStart}
              max={customEnd}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-2.5 py-1.5 text-sm outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#343233]/70">{t.menu.orderStats.customTo}</span>
            <input
              type="date"
              value={customEnd}
              min={customStart}
              max={toDateInputValue(new Date())}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-2.5 py-1.5 text-sm outline-none"
            />
          </label>
          {!customRangeValid && (
            <span className="text-xs text-red-600 pb-1.5">{t.menu.orderStats.customRangeInvalid}</span>
          )}
        </div>
      )}

      {loading || !stats ? (
        <div className="h-40 flex items-center justify-center text-sm text-[#343233]/50">
          {t.menu.orderStats.loading}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <TrendStatCard
              label={t.menu.orderStats.totalOrders}
              value={stats.totalOrders}
              changePercent={stats.changeOrdersPercent}
            />
            <TrendStatCard label={t.menu.orderStats.totalDeliveries} value={stats.totalDeliveries} />
            <TrendStatCard label={t.menu.orderStats.totalPickup} value={stats.totalPickup} />
            <TrendStatCard
              label={t.menu.orderStats.totalSales}
              value={formatCurrency(stats.totalSales, currency)}
              changePercent={stats.changeSalesPercent}
            />
          </div>

          <div className="bg-white rounded-xl border border-[#002D09]/10 p-4">
            <p className="text-xs font-semibold text-[#343233]/60 mb-3">{t.menu.orderStats.ordersChartTitle}</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stats.buckets}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#0000000f" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
                <Tooltip />
                <Bar dataKey="orders" fill="#E7FF00" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-[#002D09]/10 p-4">
            <p className="text-xs font-semibold text-[#343233]/60 mb-3">{t.menu.orderStats.salesChartTitle}</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stats.buckets}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#0000000f" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                <Bar dataKey="sales" fill="#002D09" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
