"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useDashboardLang } from "@/lib/dashboard-lang-context";
import { formatCurrency } from "@/lib/currency";
import TrendStatCard from "@/components/trend-stat-card";

type Period = "day" | "week" | "month" | "year";

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
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/tenant/order-stats?period=${period}`)
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
  }, [period]);

  const periods: { value: Period; label: string }[] = [
    { value: "day", label: t.menu.orderStats.periodDay },
    { value: "week", label: t.menu.orderStats.periodWeek },
    { value: "month", label: t.menu.orderStats.periodMonth },
    { value: "year", label: t.menu.orderStats.periodYear },
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
