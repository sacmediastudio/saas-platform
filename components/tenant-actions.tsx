"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TenantActions({
  tenantId,
  tenantName,
  suspended,
}: {
  tenantId: string;
  tenantName: string;
  suspended: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleSuspended() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/tenants/${tenantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: !suspended }),
    });
    if (!res.ok) {
      setError("No se pudo actualizar el estado.");
      setBusy(false);
      return;
    }
    router.refresh();
    setBusy(false);
  }

  async function handleDelete() {
    if (
      !confirm(
        `¿Borrar "${tenantName}" por completo? Esto elimina el negocio, sus platos/citas/links, reseñas y usuarios. No se puede deshacer.`
      )
    )
      return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/tenants/${tenantId}`, { method: "DELETE" });
    if (!res.ok) {
      setError("No se pudo borrar el negocio.");
      setBusy(false);
      return;
    }
    router.push("/admin/tenants");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          onClick={toggleSuspended}
          disabled={busy}
          className="text-sm font-medium px-4 py-2 rounded-lg border border-[#002D09]/15 hover:bg-[#F7F8F4] disabled:opacity-50"
        >
          {suspended ? "Reactivar cuenta" : "Suspender cuenta"}
        </button>
        <button
          onClick={handleDelete}
          disabled={busy}
          className="text-sm font-medium px-4 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Borrar negocio
        </button>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
