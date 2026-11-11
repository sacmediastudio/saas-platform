"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = { module: string; label: string };

// Lista los módulos activos de un negocio con un botón para desactivar
// cada uno. Solo desactiva: activar pasa por las solicitudes de módulo.
export default function TenantModulesAdmin({
  tenantId,
  tenantName,
  modules,
}: {
  tenantId: string;
  tenantName: string;
  modules: Item[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function deactivate(item: Item) {
    if (
      !confirm(
        `¿Desactivar "${item.label}" para "${tenantName}"? Si tiene suscripción en Stripe, se deja de cobrar en la próxima renovación (sin devolución de lo ya pagado). Para volver a activarlo hay que hacer una solicitud nueva.`
      )
    )
      return;
    setBusy(item.module);
    setError(null);
    const res = await fetch(`/api/admin/tenants/${tenantId}/modules`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: item.module }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo desactivar el módulo.");
      setBusy(null);
      return;
    }
    router.refresh();
    setBusy(null);
  }

  return (
    <div className="flex flex-col gap-2">
      {modules.map((m) => (
        <div key={m.module} className="flex items-center justify-between gap-4 px-4 py-2.5">
          <span className="text-sm">{m.label}</span>
          <button
            onClick={() => deactivate(m)}
            disabled={busy !== null || modules.length <= 1}
            title={modules.length <= 1 ? "El negocio necesita al menos un módulo activo" : undefined}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40"
          >
            {busy === m.module ? "Desactivando…" : "Desactivar"}
          </button>
        </div>
      ))}
      {error && <p className="text-red-600 text-sm px-4 pb-2">{error}</p>}
    </div>
  );
}
