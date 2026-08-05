import { notFound } from "next/navigation";
import { Star, Mail, Phone, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/currency";

export default async function PublicMenuPage({ params }: { params: { slug: string } }) {
  const tenant = await db.tenant.findUnique({ where: { slug: params.slug } });
  if (!tenant || tenant.businessType !== "RESTAURANT") notFound();

  const [categories, items, reviews] = await Promise.all([
    db.menuCategory.findMany({ where: { tenantId: tenant.id }, orderBy: { sortOrder: "asc" } }),
    db.menuItem.findMany({ where: { tenantId: tenant.id }, orderBy: { sortOrder: "asc" } }),
    db.review.findMany({ where: { tenantId: tenant.id, status: "PUBLISHED" } }),
  ]);

  const avgRating =
    reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  const hasContact = tenant.contactEmail || tenant.contactPhone || tenant.address;

  return (
    <div
      className="max-w-md mx-auto min-h-screen"
      style={{ backgroundColor: tenant.themeBgColor, color: tenant.themeTextColor }}
    >
      {tenant.heroImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tenant.heroImageUrl} alt="" className="w-full h-40 object-cover" />
      )}

      <div className="px-5 pt-6 pb-4 text-center border-b" style={{ borderColor: "currentColor", opacity: 1 }}>
        {tenant.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.logoUrl} alt={tenant.name} className="w-12 h-12 rounded-xl mx-auto mb-2.5 object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-xl mx-auto mb-2.5" style={{ backgroundColor: tenant.themeTextColor }} />
        )}
        <p className="text-base font-semibold">{tenant.name}</p>
        {avgRating && (
          <p className="flex items-center justify-center gap-1 text-xs opacity-70 mt-1.5">
            <Star size={12} className="fill-amber-400 text-amber-400" aria-hidden />
            {avgRating} · {reviews.length} reseñas
          </p>
        )}
      </div>

      {categories.map((cat) => {
        const catItems = items.filter((i) => i.categoryId === cat.id);
        if (catItems.length === 0) return null;
        return (
          <div key={cat.id} className="px-5 py-4">
            <h2 className="text-sm font-medium opacity-60 mb-3">{cat.name}</h2>
            <div className="flex flex-col gap-4">
              {catItems.map((item) => (
                <div key={item.id} className={`flex gap-2.5 ${item.status === "SOLD_OUT" ? "opacity-50" : ""}`}>
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-14 h-14 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg shrink-0 opacity-10" style={{ backgroundColor: "currentColor" }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.name}</p>
                    {item.description && (
                      <p className="text-xs opacity-60 mt-0.5 mb-1.5">{item.description}</p>
                    )}
                    {item.status === "SOLD_OUT" ? (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-red-50 text-red-700">Agotado</span>
                    ) : (
                      <span className="text-sm font-medium">{formatCurrency(Number(item.price), tenant.currency)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="px-5 pb-4 pt-2">
        <a
          href={`/review/${tenant.slug}`}
          className="flex items-center justify-center gap-1.5 w-full py-2.5 text-sm font-medium border rounded-lg opacity-90 hover:opacity-100"
          style={{ borderColor: "currentColor" }}
        >
          <Star size={14} aria-hidden />
          Dejar una reseña
        </a>
      </div>

      {hasContact && (
        <div className="px-5 pb-8 pt-3 border-t text-xs opacity-60 flex flex-col gap-1.5" style={{ borderColor: "currentColor" }}>
          {tenant.address && (
            <span className="flex items-center gap-1.5">
              <MapPin size={13} aria-hidden /> {tenant.address}
            </span>
          )}
          {tenant.contactPhone && (
            <span className="flex items-center gap-1.5">
              <Phone size={13} aria-hidden /> {tenant.contactPhone}
            </span>
          )}
          {tenant.contactEmail && (
            <span className="flex items-center gap-1.5">
              <Mail size={13} aria-hidden /> {tenant.contactEmail}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
