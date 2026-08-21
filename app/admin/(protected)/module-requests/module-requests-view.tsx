"use client";

import { useState } from "react";
import { Send, Check, X } from "lucide-react";
import DashboardCard from "@/components/dashboard-card";

interface ModuleRequest {
  id: string;
  tenantName: string;
  tenantSlug: string;
  module: string;
  status: string;
  requestedAt: string;
}

const MODULE_LABELS: Record<string, string> = {
  RESTAURANT: "Menú",
  SMALL_BUSINESS: "Citas",
  SMARTLINK: "Smartlink",
};

export default function ModuleRequestsView({ requests: initialRequests }: { requests: ModuleRequest[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "resolved">("pending");

  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending");
  const shown = tab === "pending" ? pending : resolved;

  async function handleAction(request: ModuleRequest, action: "approve" | "reject") {
    setBusyId(request.id);
    const res = await fetch(`/api/admin/module-requests/${request.id}/${action}`, { method: "POST" });
    if (res.ok) {
      setRequests((prev) =>
        prev.map((r) => (r.id === request.id ? { ...r, status: action === "approve" ? "approved" : "rejected" } : r))
      );
    }
    setBusyId(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <DashboardCard>
        <h1 className="text-xl font-semibold mb-1 flex items-center gap-2">
          <Send size={20} aria-hidden />
          Solicitudes de activación
        </h1>
        <p className="text-sm text-[#343233]/70 mb-6">
          Cuando un negocio pide activar un módulo nuevo desde su dashboard, aparece acá — revísalo
          y actívalo a mano (o rechazalo si preferís hablar con el negocio primero).
        </p>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab("pending")}
            className={`text-sm font-medium px-3.5 h-9 rounded-lg ${tab === "pending" ? "bg-[#002D09] text-white" : "border border-[#002D09]/15"}`}
          >
            Pendientes ({pending.length})
          </button>
          <button
            onClick={() => setTab("resolved")}
            className={`text-sm font-medium px-3.5 h-9 rounded-lg ${tab === "resolved" ? "bg-[#002D09] text-white" : "border border-[#002D09]/15"}`}
          >
            Resueltas
          </button>
        </div>

        {shown.length === 0 && (
          <p className="text-sm text-[#343233]/60">
            {tab === "pending" ? "No hay ninguna solicitud pendiente." : "Todavía no hay historial."}
          </p>
        )}

        <div className="border border-[#002D09]/10 rounded-lg overflow-hidden divide-y divide-[#002D09]/10">
          {shown.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-[160px]">
                <p className="text-sm font-medium">{r.tenantName}</p>
                <p className="text-xs text-[#343233]/60">
                  Quiere activar <strong>{MODULE_LABELS[r.module] ?? r.module}</strong> —{" "}
                  {new Date(r.requestedAt).toLocaleDateString("es", { day: "numeric", month: "short" })}
                </p>
              </div>

              {r.status === "pending" ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction(r, "approve")}
                    disabled={busyId === r.id}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-[#E7FF00] text-[#002D09] hover:brightness-105 disabled:opacity-50"
                  >
                    <Check size={13} aria-hidden />
                    Activar
                  </button>
                  <button
                    onClick={() => handleAction(r, "reject")}
                    disabled={busyId === r.id}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-[#002D09]/15 hover:bg-[#F7F8F4] disabled:opacity-50"
                  >
                    <X size={13} aria-hidden />
                    Rechazar
                  </button>
                </div>
              ) : (
                <span
                  className={`text-xs px-2.5 py-1 rounded-md font-medium ${
                    r.status === "approved" ? "bg-green-50 text-green-700" : "bg-[#F7F8F4] text-[#343233]/70"
                  }`}
                >
                  {r.status === "approved" ? "Activado" : "Rechazado"}
                </span>
              )}
            </div>
          ))}
        </div>
      </DashboardCard>
    </div>
  );
}
