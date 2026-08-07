import { db } from "@/lib/db";

const TYPE_LABELS: Record<string, string> = {
  RESTAURANT: "Restaurante",
  SMALL_BUSINESS: "Citas",
  SMARTLINK: "Smartlink",
};

export default async function AdminTenantsPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string };
}) {
  const q = searchParams.q?.trim() ?? "";
  const type = searchParams.type ?? "";

  const tenants = await db.tenant.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(type ? { businessType: type as any } : {}),
    },
    include: { subscription: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Negocios</h1>
      <p className="text-sm text-[#343233]/70 mb-6">{tenants.length} resultado(s)</p>

      <form className="flex flex-wrap gap-2 mb-6" method="GET">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o slug..."
          className="flex-1 min-w-[200px] bg-white border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#002D09]/40"
        />
        <select
          name="type"
          defaultValue={type}
          className="bg-white border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none"
        >
          <option value="">Todos los tipos</option>
          <option value="RESTAURANT">Restaurantes</option>
          <option value="SMALL_BUSINESS">Citas</option>
          <option value="SMARTLINK">Smartlink</option>
        </select>
        <button type="submit" className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#E7FF00] text-[#002D09]">
          Buscar
        </button>
      </form>

      <div className="border border-[#002D09]/10 rounded-lg overflow-hidden divide-y divide-[#002D09]/10">
        {tenants.map((t) => (
          <a
            key={t.id}
            href={`/admin/tenants/${t.id}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-[#F7F8F4]"
          >
            <div className="flex-1 min-w-[180px]">
              <p className="text-sm font-medium flex items-center gap-2">
                {t.name}
                {t.suspended && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-semibold">
                    SUSPENDIDO
                  </span>
                )}
              </p>
              <p className="text-xs text-[#343233]/60">/{t.slug}</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-md bg-[#F7F8F4]">{TYPE_LABELS[t.businessType]}</span>
            <span className="text-xs text-[#343233]/60 capitalize">
              {t.subscription?.status ?? "sin suscripción"}
            </span>
            <span className="text-xs text-[#343233]/50 ml-auto">
              {t.createdAt.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </a>
        ))}
        {tenants.length === 0 && (
          <p className="px-4 py-6 text-sm text-[#343233]/60">No hay negocios que coincidan con la búsqueda.</p>
        )}
      </div>
    </div>
  );
}
