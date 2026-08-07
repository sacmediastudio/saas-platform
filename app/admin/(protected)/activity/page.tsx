import { db } from "@/lib/db";

const ACTION_LABELS: Record<string, { label: string; className: string }> = {
  SUSPEND: { label: "Suspendió", className: "bg-red-50 text-red-700" },
  UNSUSPEND: { label: "Reactivó", className: "bg-green-50 text-green-700" },
  DELETE_TENANT: { label: "Borró", className: "bg-red-50 text-red-700" },
  UPDATE_SUBSCRIPTION: { label: "Editó suscripción", className: "bg-[#F7F8F4] text-[#343233]" },
};

export default async function AdminActivityPage() {
  const logs = await db.adminActivityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Actividad</h1>
      <p className="text-sm text-[#343233]/70 mb-6">Últimas 100 acciones hechas desde este panel</p>

      <div className="border border-[#002D09]/10 rounded-lg overflow-hidden divide-y divide-[#002D09]/10">
        {logs.map((log) => {
          const meta = ACTION_LABELS[log.action] ?? { label: log.action, className: "bg-[#F7F8F4] text-[#343233]" };
          return (
            <div key={log.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
              <span className={`text-xs px-2 py-1 rounded-md font-medium shrink-0 ${meta.className}`}>
                {meta.label}
              </span>
              <div className="flex-1 min-w-[160px]">
                <p className="text-sm font-medium">
                  {log.tenantId ? (
                    <a href={`/admin/tenants/${log.tenantId}`} className="hover:underline">
                      {log.tenantName}
                    </a>
                  ) : (
                    log.tenantName
                  )}
                </p>
                {log.details && <p className="text-xs text-[#343233]/60">{log.details}</p>}
              </div>
              <span className="text-xs text-[#343233]/60 shrink-0">{log.adminEmail}</span>
              <span className="text-xs text-[#343233]/50 shrink-0">
                {log.createdAt.toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          );
        })}
        {logs.length === 0 && (
          <p className="px-4 py-6 text-sm text-[#343233]/60">Todavía no hay actividad registrada.</p>
        )}
      </div>
    </div>
  );
}
