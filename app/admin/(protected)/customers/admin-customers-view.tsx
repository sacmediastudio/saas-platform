"use client";

import { useState } from "react";
import { Users, Download } from "lucide-react";
import DashboardCard from "@/components/dashboard-card";

interface Customer {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  tenantName: string;
  tenantSlug: string;
  fromBooking: boolean;
  fromReview: boolean;
  fromMenuLead: boolean;
  unsubscribed: boolean;
  lastSeenAt: string;
}

function sourceLabel(c: Customer): string {
  const parts: string[] = [];
  if (c.fromBooking) parts.push("Citas");
  if (c.fromReview) parts.push("Reseñas");
  if (c.fromMenuLead) parts.push("Menú");
  return parts.join(" · ") || "—";
}

function exportCsv(customers: Customer[]) {
  const rows = [
    ["Negocio", "Nombre", "Correo", "Teléfono", "Origen", "Desuscrito", "Última vez"],
    ...customers.map((c) => [
      c.tenantName,
      c.name ?? "",
      c.email,
      c.phone ?? "",
      sourceLabel(c),
      c.unsubscribed ? "Sí" : "No",
      new Date(c.lastSeenAt).toLocaleDateString("es"),
    ]),
  ];
  const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "clientes-todos-los-negocios.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminCustomersView({ customers }: { customers: Customer[] }) {
  const [search, setSearch] = useState("");

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      c.email.toLowerCase().includes(q) ||
      c.name?.toLowerCase().includes(q) ||
      c.tenantName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-5">
      <DashboardCard>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Users size={20} aria-hidden />
            Clientes — todos los negocios
          </h1>
          <button
            onClick={() => exportCsv(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 text-sm font-medium border border-[#002D09]/15 px-3 h-9 rounded-lg hover:bg-[#F7F8F4] disabled:opacity-40"
          >
            <Download size={15} aria-hidden />
            Exportar CSV
          </button>
        </div>
        <p className="text-sm text-[#343233]/70 mb-4">
          {customers.length} clientes en total, de todos los negocios de la plataforma (últimos 500).
        </p>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, correo, o negocio..."
          className="w-full bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none mb-4"
        />

        <div className="border border-[#002D09]/10 rounded-lg overflow-hidden divide-y divide-[#002D09]/10">
          {filtered.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-[160px]">
                <p className="text-sm font-medium">{c.name ?? c.email}</p>
                <p className="text-xs text-[#343233]/60">
                  {c.email}
                  {c.phone ? ` · ${c.phone}` : ""}
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded-md bg-[#F7F8F4] shrink-0">{c.tenantName}</span>
              <span className="text-xs px-2 py-1 rounded-md bg-[#F7F8F4] shrink-0">{sourceLabel(c)}</span>
              {c.unsubscribed && (
                <span className="text-xs px-2 py-1 rounded-md bg-red-50 text-red-700 shrink-0">Desuscrito</span>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-sm text-[#343233]/60">No hay clientes que coincidan.</p>
          )}
        </div>
      </DashboardCard>
    </div>
  );
}
