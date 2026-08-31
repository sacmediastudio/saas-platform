"use client";

import { Users, Download } from "lucide-react";
import DashboardCard from "@/components/dashboard-card";
import { useDashboardLang } from "@/lib/dashboard-lang-context";

interface Customer {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  fromBooking: boolean;
  fromReview: boolean;
  fromMenuLead: boolean;
  lastSeenAt: string;
}

function sourceLabel(c: Customer, t: ReturnType<typeof useDashboardLang>["t"]): string {
  const parts: string[] = [];
  if (c.fromBooking) parts.push(t.customers.sourceBookings);
  if (c.fromReview) parts.push(t.customers.sourceReviews);
  if (c.fromMenuLead) parts.push(t.customers.sourceMenu);
  return parts.join(" · ") || "—";
}

function exportCsv(customers: Customer[], t: ReturnType<typeof useDashboardLang>["t"], lang: "es" | "en") {
  const rows = [
    t.customers.csvHeaders,
    ...customers.map((c) => [
      c.name ?? "",
      c.email,
      c.phone ?? "",
      sourceLabel(c, t),
      new Date(c.lastSeenAt).toLocaleDateString(lang),
    ]),
  ];
  const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = t.customers.csvFilename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CustomersView({ customers }: { customers: Customer[] }) {
  const { t, lang } = useDashboardLang();

  return (
    <div className="flex flex-col gap-5">
      <DashboardCard>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Users size={20} aria-hidden />
            {t.customers.title}
          </h1>
          <button
            onClick={() => exportCsv(customers, t, lang)}
            disabled={customers.length === 0}
            className="flex items-center gap-1.5 text-sm font-medium border border-[#002D09]/15 px-3 h-9 rounded-lg hover:bg-[#F7F8F4] disabled:opacity-40"
          >
            <Download size={15} aria-hidden />
            {t.customers.exportCsv}
          </button>
        </div>
        <p className="text-sm text-[#343233]/70 mb-6">{t.customers.subtitle(customers.length)}</p>

        {customers.length === 0 && <p className="text-sm text-[#343233]/60">{t.customers.empty}</p>}

        <div className="border border-[#002D09]/10 rounded-lg overflow-hidden divide-y divide-[#002D09]/10">
          {customers.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-[160px]">
                <p className="text-sm font-medium">{c.name ?? c.email}</p>
                <p className="text-xs text-[#343233]/60">
                  {c.email}
                  {c.phone ? ` · ${c.phone}` : ""}
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded-md bg-[#F7F8F4] shrink-0">{sourceLabel(c, t)}</span>
              <span className="text-xs text-[#343233]/50 shrink-0">
                {new Date(c.lastSeenAt).toLocaleDateString(lang, { day: "numeric", month: "short" })}
              </span>
            </div>
          ))}
        </div>
      </DashboardCard>
    </div>
  );
}
