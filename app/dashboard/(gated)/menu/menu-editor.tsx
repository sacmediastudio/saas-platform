"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, X, Image as ImageIcon, Copy, Check, Upload, ArrowUp, ArrowDown } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import TrendStatCard from "@/components/trend-stat-card";
import { useDashboardLang } from "@/lib/dashboard-lang-context";
import { uploadImage } from "@/lib/upload-image";
import DashboardCard from "@/components/dashboard-card";

interface AddOn {
  id?: string;
  name: string;
  price: number;
}
interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  descriptionEn: string | null;
  price: number;
  variablePrice: boolean;
  status: "AVAILABLE" | "SOLD_OUT" | "SEASONAL";
  imageUrl: string | null;
  featured: boolean;
  sortOrder: number;
  addOns?: AddOn[];
}
interface Category {
  id: string;
  name: string;
  nameEn: string | null;
}

const statusStyles: Record<MenuItem["status"], { className: string }> = {
  AVAILABLE: { className: "bg-green-50 text-green-700" },
  SOLD_OUT: { className: "bg-red-50 text-red-700" },
  SEASONAL: { className: "bg-amber-50 text-amber-700" },
};

export default function MenuEditor({
  categories: initialCategories,
  initialItems,
  currency,
  slug,
  viewsLast7Days,
  viewsChangePercent,
  totalViews,
  avgRating,
}: {
  categories: Category[];
  initialItems: MenuItem[];
  currency: string;
  slug: string;
  viewsLast7Days: number;
  viewsChangePercent: number | null;
  totalViews: number;
  avgRating: number | null;
}) {
  const { t } = useDashboardLang();
  const [categories, setCategories] = useState(initialCategories);
  const [items, setItems] = useState(initialItems);
  const [saving, setSaving] = useState<string | null>(null);
  const [dishModal, setDishModal] = useState<{ mode: "create" | "edit"; item?: MenuItem } | null>(null);
  const [categoryModal, setCategoryModal] = useState<{ mode: "create" | "edit"; category?: Category } | null>(
    null
  );
  const [copied, setCopied] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/menu/${slug}` : `/menu/${slug}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // no crítico si el navegador bloquea el acceso al portapapeles
    }
  }

  const activeCount = items.filter((i) => i.status !== "SOLD_OUT").length;

  async function cycleStatus(item: MenuItem) {
    const order: MenuItem["status"][] = ["AVAILABLE", "SOLD_OUT", "SEASONAL"];
    const next = order[(order.indexOf(item.status) + 1) % order.length];
    setSaving(item.id);
    const prevStatus = item.status;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: next } : i)));

    const res = await fetch(`/api/menu-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: prevStatus } : i)));
    }
    setSaving(null);
  }

  async function deleteDish(item: MenuItem) {
    if (!confirm(t.menu.confirmDeleteDish(item.name))) return;
    setSaving(item.id);
    const res = await fetch(`/api/menu-items/${item.id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    }
    setSaving(null);
  }

  // Reordena DENTRO de la misma categoría — subir/bajar un plato nunca
  // lo mueve a otra categoría, solo cambia su posición en la lista.
  async function moveDish(item: MenuItem, direction: -1 | 1) {
    const catItems = items.filter((i) => i.categoryId === item.categoryId);
    const idx = catItems.findIndex((i) => i.id === item.id);
    const swapWith = catItems[idx + direction];
    if (!swapWith) return;

    setSaving(item.id);
    const prev = items;
    setItems((list) =>
      list.map((i) => {
        if (i.id === item.id) return { ...i, sortOrder: swapWith.sortOrder };
        if (i.id === swapWith.id) return { ...i, sortOrder: item.sortOrder };
        return i;
      })
    );

    const [res1, res2] = await Promise.all([
      fetch(`/api/menu-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: swapWith.sortOrder }),
      }),
      fetch(`/api/menu-items/${swapWith.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: item.sortOrder }),
      }),
    ]);
    if (!res1.ok || !res2.ok) setItems(prev);
    setSaving(null);
  }

  async function deleteCategory(cat: Category) {
    const hasItems = items.some((i) => i.categoryId === cat.id);
    if (hasItems) {
      alert("Esta categoría tiene platos dentro. Muévelos o bórralos antes de eliminar la categoría.");
      return;
    }
    if (!confirm(t.menu.confirmDeleteCategory(cat.name))) return;
    const res = await fetch(`/api/menu-categories/${cat.id}`, { method: "DELETE" });
    if (res.ok) {
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    } else {
      const body = await res.json().catch(() => null);
      alert(body?.error ?? t.menu.deleteCategoryFailed);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <DashboardCard>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-semibold">{t.menu.title}</h1>
            <p className="text-sm text-[#343233]/70 mt-1">{t.menu.subtitle}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setImportModalOpen(true)}
              className="flex items-center gap-1.5 text-sm font-medium border border-[#002D09]/15 px-3 h-9 rounded-lg hover:bg-[#F7F8F4]"
            >
              <Upload size={16} aria-hidden />
              {t.menu.importFromExcel}
            </button>
            <button
              onClick={() => setCategoryModal({ mode: "create" })}
              className="flex items-center gap-1.5 text-sm font-medium border border-[#002D09]/15 px-3 h-9 rounded-lg hover:bg-[#F7F8F4]"
            >
              <Plus size={16} aria-hidden />
              {t.menu.addCategory}
            </button>
            <button
              onClick={() => setDishModal({ mode: "create" })}
              disabled={categories.length === 0}
              className="flex items-center gap-1.5 text-sm font-medium bg-[#E7FF00] text-[#002D09] px-3.5 h-9 rounded-lg hover:brightness-105 disabled:opacity-40"
            >
              <Plus size={16} aria-hidden />
              {t.menu.addDish}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[#F7F8F4] rounded-lg px-3 py-2 mb-7">
          <span className="text-sm text-[#002D09] truncate flex-1">{publicUrl}</span>
          <button onClick={copyLink} className="text-[#343233]/70 hover:text-[#002D09] shrink-0">
            {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 divide-x divide-black/[0.06]">
          <TrendStatCard label={t.menu.activeDishes} value={activeCount} />
          <TrendStatCard label={t.menu.totalViews} value={totalViews} />
          <TrendStatCard label={t.menu.views7d} value={viewsLast7Days} changePercent={viewsChangePercent} />
          <TrendStatCard label={t.menu.avgRating} value={avgRating !== null ? avgRating.toFixed(1) : "—"} />
        </div>
      </DashboardCard>

      <DashboardCard>
      {categories.length === 0 && (
        <p className="text-sm text-[#343233]/60 mb-4">
          Todavía no tienes categorías. Crea la primera para poder agregar platos.
        </p>
      )}

      {categories.map((cat) => {
        const catItems = items.filter((i) => i.categoryId === cat.id);
        return (
          <div key={cat.id} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-[#343233]/70">{cat.name}</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCategoryModal({ mode: "edit", category: cat })}
                  aria-label={t.menu.renameCategory(cat.name)}
                  className="text-[#343233]/60 hover:text-[#002D09]"
                >
                  <Pencil size={13} aria-hidden />
                </button>
                <button
                  onClick={() => deleteCategory(cat)}
                  aria-label={t.menu.deleteCategory(cat.name)}
                  className="text-[#343233]/60 hover:text-red-600"
                >
                  <Trash2 size={13} aria-hidden />
                </button>
              </div>
            </div>

            {catItems.length === 0 ? (
              <p className="text-xs text-[#343233]/40">Sin platos todavía.</p>
            ) : (
              <div className="border border-[#002D09]/10 rounded-lg overflow-hidden divide-y divide-[#002D09]/10">
                {catItems.map((item, idx) => {
                  const s = statusStyles[item.status];
                  return (
                    <div key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
                      <div className="flex items-center gap-3 flex-1 min-w-[160px]">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-[#F7F8F4] shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm flex items-center gap-1.5 flex-wrap">
                            {item.name}
                            {item.featured && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-normal">
                                ★ {t.dishModal.featuredBadge}
                              </span>
                            )}
                          </p>
                          {item.description && (
                            <p className="text-xs text-[#343233]/70 mt-0.5">{item.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                      <span className="text-sm font-medium">{formatCurrency(item.price, currency)}</span>
                      <button
                        onClick={() => cycleStatus(item)}
                        disabled={saving === item.id}
                        className={`text-xs px-2.5 py-1 rounded-md font-medium ${s.className}`}
                      >
                        {t.dishModal.status[item.status]}
                      </button>
                      <button
                        onClick={() => moveDish(item, -1)}
                        disabled={idx === 0 || saving === item.id}
                        aria-label={t.common.moveUp}
                        className="text-[#343233]/60 hover:text-[#002D09] disabled:opacity-30"
                      >
                        <ArrowUp size={14} aria-hidden />
                      </button>
                      <button
                        onClick={() => moveDish(item, 1)}
                        disabled={idx === catItems.length - 1 || saving === item.id}
                        aria-label={t.common.moveDown}
                        className="text-[#343233]/60 hover:text-[#002D09] disabled:opacity-30"
                      >
                        <ArrowDown size={14} aria-hidden />
                      </button>
                      <button
                        onClick={() => setDishModal({ mode: "edit", item })}
                        aria-label={t.menu.editDish(item.name)}
                        className="text-[#343233]/60 hover:text-[#002D09]"
                      >
                        <Pencil size={15} aria-hidden />
                      </button>
                      <button
                        onClick={() => deleteDish(item)}
                        disabled={saving === item.id}
                        aria-label={t.menu.deleteDish(item.name)}
                        className="text-[#343233]/60 hover:text-red-600"
                      >
                        <Trash2 size={15} aria-hidden />
                      </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      </DashboardCard>

      {dishModal && (
        <DishModal
          mode={dishModal.mode}
          item={dishModal.item}
          categories={categories}
          onClose={() => setDishModal(null)}
          onCreated={(item) => setItems((prev) => [...prev, item])}
          onUpdated={(item) => setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)))}
        />
      )}

      {categoryModal && (
        <CategoryModal
          mode={categoryModal.mode}
          category={categoryModal.category}
          onClose={() => setCategoryModal(null)}
          onCreated={(cat) => setCategories((prev) => [...prev, cat])}
          onUpdated={(cat) => setCategories((prev) => prev.map((c) => (c.id === cat.id ? cat : c)))}
        />
      )}

      {importModalOpen && <ImportModal onClose={() => setImportModalOpen(false)} />}
    </div>
  );
}

function DishModal({
  mode,
  item,
  categories,
  onClose,
  onCreated,
  onUpdated,
}: {
  mode: "create" | "edit";
  item?: MenuItem;
  categories: Category[];
  onClose: () => void;
  onCreated: (item: MenuItem) => void;
  onUpdated: (item: MenuItem) => void;
}) {
  const { t } = useDashboardLang();
  const [form, setForm] = useState({
    name: item?.name ?? "",
    description: item?.description ?? "",
    descriptionEn: item?.descriptionEn ?? "",
    price: item ? String(item.price) : "",
    variablePrice: item?.variablePrice ?? false,
    categoryId: item?.categoryId ?? categories[0]?.id ?? "",
    imageUrl: (item?.imageUrl ?? null) as string | null,
    featured: item?.featured ?? false,
  });
  const [addOns, setAddOns] = useState<AddOn[]>(item?.addOns ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessingImage(true);
    try {
      const publicUrl = await uploadImage(file);
      setForm((f) => ({ ...f, imageUrl: publicUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la imagen. Intenta con otra foto.");
    } finally {
      setProcessingImage(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const price = Number(form.price);
    if (!form.categoryId) {
      setError(t.menu.pickCategory);
      return;
    }
    if (!form.variablePrice && (!Number.isFinite(price) || price <= 0)) {
      setError("Ingresa un precio válido (o marca 'Precio variable')");
      return;
    }

    setSaving(true);
    try {
      const url = mode === "create" ? "/api/menu-items" : `/api/menu-items/${item!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: form.categoryId,
          name: form.name,
          description: form.description || undefined,
          descriptionEn: form.descriptionEn || null,
          price: form.variablePrice ? 0 : price,
          variablePrice: form.variablePrice,
          imageUrl: form.imageUrl,
          featured: form.featured,
          addOns: addOns.filter((a) => a.name.trim()).map((a) => ({ name: a.name.trim(), price: a.price || 0 })),
          ...(mode === "create" ? { allergens: [] } : {}),
        }),
      });

      if (!res.ok) {
        let message = t.menu.saveDishFailed;
        try {
          const body = await res.json();
          if (typeof body.error === "string") message = body.error;
        } catch {}
        setError(message);
        setSaving(false);
        return;
      }

      const { item: saved } = await res.json();
      const normalized: MenuItem = { ...saved, price: Number(saved.price) };
      if (mode === "create") onCreated(normalized);
      else onUpdated(normalized);
      onClose();
    } catch {
      setError(t.menu.genericError);
      setSaving(false);
    }
  }

  return (
    <ModalShell title={mode === "create" ? t.dishModal.titleCreate : t.dishModal.titleEdit} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label={t.dishModal.photo}>
          <div className="flex items-center gap-3">
            {form.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-[#F7F8F4] flex items-center justify-center shrink-0 text-[#343233]/40">
                <ImageIcon size={20} aria-hidden />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-xs px-2.5 py-1.5 rounded-md border border-[#002D09]/15 hover:bg-[#F7F8F4] cursor-pointer w-fit">
                {processingImage ? t.common.uploading : t.common.uploadPhoto}
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
              {form.imageUrl && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, imageUrl: null }))}
                  className="text-xs text-[#343233]/60 hover:text-red-600 text-left"
                >
                  {t.common.removePhoto}
                </button>
              )}
            </div>
          </div>
        </Field>

        <Field label={t.dishModal.name}>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder={t.dishModal.namePlaceholder}
            className={inputClass}
          />
        </Field>

        <Field label={t.dishModal.category}>
          <select
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            required
            className={inputClass}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t.dishModal.price}>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            required={!form.variablePrice}
            disabled={form.variablePrice}
            placeholder="6.50"
            className={`${inputClass} disabled:opacity-40 disabled:cursor-not-allowed`}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm cursor-pointer -mt-1">
          <input
            type="checkbox"
            checked={form.variablePrice}
            onChange={(e) => setForm({ ...form, variablePrice: e.target.checked })}
            className="w-4 h-4 accent-[#E7FF00]"
          />
          <span>
            Precio variable (ej. por peso) — en el menú público se muestra{" "}
            <strong>&ldquo;Preguntar&rdquo; / &ldquo;Ask&rdquo;</strong> en vez de un precio
          </span>
        </label>
        {form.variablePrice && (
          <p className="text-xs text-[#343233]/60 -mt-3">
            Este plato no se va a poder agregar al carrito de pedidos online — el cliente tiene que
            preguntar el precio en el local, como con cualquier plato de precio variable.
          </p>
        )}

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) => setForm({ ...form, featured: e.target.checked })}
            className="w-4 h-4 accent-white"
          />
          {t.dishModal.featured}
        </label>

        <Field label={t.dishModal.description}>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            placeholder="Tomate, albahaca, ajo"
            className={`${inputClass} resize-none`}
          />
        </Field>

        <Field label={t.dishModal.descriptionEn}>
          <textarea
            value={form.descriptionEn}
            onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
            rows={2}
            placeholder="Tomato, basil, garlic"
            className={`${inputClass} resize-none`}
          />
        </Field>

        <div>
          <p className="text-xs text-[#343233]/70 mb-1.5">Add-ons (papas, extra queso, etc.)</p>
          <div className="flex flex-col gap-2">
            {addOns.map((addOn, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={addOn.name}
                  onChange={(e) =>
                    setAddOns((prev) => prev.map((a, j) => (j === i ? { ...a, name: e.target.value } : a)))
                  }
                  placeholder={t.dishModal.addOnNamePlaceholder}
                  className="flex-1 min-w-0 bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#002D09]/40"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={addOn.price || ""}
                  onChange={(e) =>
                    setAddOns((prev) =>
                      prev.map((a, j) => (j === i ? { ...a, price: Number(e.target.value) || 0 } : a))
                    )
                  }
                  placeholder="0"
                  className="w-20 shrink-0 bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#002D09]/40"
                />
                <button
                  type="button"
                  onClick={() => setAddOns((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="Quitar add-on"
                  className="text-[#343233]/50 hover:text-red-600 shrink-0"
                >
                  <X size={16} aria-hidden />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAddOns((prev) => [...prev, { name: "", price: 0 }])}
            className="flex items-center gap-1 text-xs font-medium mt-2 text-[#343233]/70 hover:text-[#002D09]"
          >
            <Plus size={13} aria-hidden />
            Agregar add-on
          </button>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <ModalActions
          saving={saving || processingImage}
          onClose={onClose}
          submitLabel={mode === "create" ? t.common.add : t.common.save}
        />
      </form>
    </ModalShell>
  );
}

function CategoryModal({
  mode,
  category,
  onClose,
  onCreated,
  onUpdated,
}: {
  mode: "create" | "edit";
  category?: Category;
  onClose: () => void;
  onCreated: (cat: Category) => void;
  onUpdated: (cat: Category) => void;
}) {
  const { t } = useDashboardLang();
  const [name, setName] = useState(category?.name ?? "");
  const [nameEn, setNameEn] = useState(category?.nameEn ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const url = mode === "create" ? "/api/menu-categories" : `/api/menu-categories/${category!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, nameEn: nameEn || null }),
      });

      if (!res.ok) {
        let message = t.menu.saveCategoryFailed;
        try {
          const body = await res.json();
          if (typeof body.error === "string") message = body.error;
        } catch {}
        setError(message);
        setSaving(false);
        return;
      }

      const { category: saved } = await res.json();
      if (mode === "create") onCreated(saved);
      else onUpdated(saved);
      onClose();
    } catch {
      setError(t.menu.genericError);
      setSaving(false);
    }
  }

  return (
    <ModalShell title={mode === "create" ? t.categoryModal.titleCreate : t.categoryModal.titleEdit} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label={t.categoryModal.name}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Postres"
            className={inputClass}
            autoFocus
          />
        </Field>
        <Field label={t.categoryModal.nameEn}>
          <input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder="Desserts"
            className={inputClass}
          />
        </Field>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <ModalActions saving={saving} onClose={onClose} submitLabel={mode === "create" ? t.common.create : t.common.save} />
      </form>
    </ModalShell>
  );
}

const inputClass =
  "w-full bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#002D09]/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-[#343233]/70">{label}</span>
      {children}
    </label>
  );
}

function ModalActions({
  saving,
  onClose,
  submitLabel,
}: {
  saving: boolean;
  onClose: () => void;
  submitLabel: string;
}) {
  const { t } = useDashboardLang();
  return (
    <div className="flex gap-2 mt-1">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 py-2 rounded-lg border border-[#002D09]/15 text-sm hover:bg-[#F7F8F4]"
      >
        {t.common.cancel}
      </button>
      <button
        type="submit"
        disabled={saving}
        className="flex-1 py-2 rounded-lg bg-[#E7FF00] text-[#002D09] text-sm font-medium hover:brightness-105 disabled:opacity-50"
      >
        {saving ? t.common.saving : submitLabel}
      </button>
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useDashboardLang();
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-[#002D09]/10 rounded-xl w-full max-w-sm p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label={t.common.close} className="text-[#343233]/60 hover:text-[#002D09]">
            <X size={18} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface ImportRow {
  rowNumber: number;
  categoria: string;
  nombre: string;
  descripcion: string;
  descripcionEn: string;
  precio: number | null;
  variablePrice: boolean;
  destacado: boolean;
  errors: string[];
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const { t } = useDashboardLang();
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [validRows, setValidRows] = useState<ImportRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; categoriesCreated: number } | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/menu-items/import/preview", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? t.menu.importReadFailed);
        setLoading(false);
        return;
      }
      setValidRows(body.validRows);
      setInvalidRows(body.invalidRows);
      setStep("preview");
    } catch {
      setError(t.menu.genericError);
    }
    setLoading(false);
    e.target.value = ""; // permite volver a subir el mismo archivo si hace falta reintentar
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/menu-items/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: validRows.map((r) => ({
            categoria: r.categoria,
            nombre: r.nombre,
            descripcion: r.descripcion || undefined,
            descripcionEn: r.descripcionEn || undefined,
            precio: r.precio,
            variablePrice: r.variablePrice,
            destacado: r.destacado,
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? t.menu.importFailed);
        setLoading(false);
        return;
      }
      setResult(body);
      setStep("done");
    } catch {
      setError(t.menu.genericError);
    }
    setLoading(false);
  }

  return (
    <ModalShell title={t.menu.importModalTitle} onClose={onClose}>
      {step === "upload" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[#343233]/70">{t.menu.importIntro}</p>
          <a
            href="/api/menu-items/template"
            className="flex items-center justify-center gap-1.5 text-sm font-medium border border-[#002D09]/15 h-9 rounded-lg hover:bg-[#F7F8F4]"
          >
            {t.menu.downloadTemplate}
          </a>
          <label className="flex items-center justify-center gap-1.5 text-sm font-semibold h-10 rounded-lg bg-[#E7FF00] text-[#002D09] hover:brightness-105 cursor-pointer">
            <Upload size={15} aria-hidden />
            {loading ? t.menu.reading : t.menu.uploadFilledFile}
            <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} disabled={loading} className="hidden" />
          </label>
          <p className="text-xs text-[#343233]/50 text-center -mt-2">{t.menu.fileLimits}</p>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>
      )}

      {step === "preview" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[#343233]/70">
            {t.menu.readyToImport(validRows.length)}
            {invalidRows.length > 0 ? t.menu.importErrorsSummary(invalidRows.length) : ""}.
          </p>

          {validRows.length > 0 && (
            <div className="border border-[#002D09]/10 rounded-lg overflow-hidden divide-y divide-[#002D09]/10 max-h-52 overflow-y-auto">
              {validRows.map((r) => (
                <div key={r.rowNumber} className="px-3 py-2 text-sm">
                  <span className="font-medium">{r.nombre}</span>
                  <span className="text-[#343233]/60">
                    {" "}
                    — {r.categoria} — {r.variablePrice ? t.menu.variablePriceLabel : `$${r.precio?.toFixed(2)}`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {invalidRows.length > 0 && (
            <div className="border border-red-200 bg-red-50 rounded-lg overflow-hidden divide-y divide-red-200 max-h-40 overflow-y-auto">
              {invalidRows.map((r) => (
                <div key={r.rowNumber} className="px-3 py-2 text-sm">
                  <span className="font-medium">{t.menu.row(r.rowNumber)}</span>
                  <span className="text-red-700"> — {r.errors.join(", ")}</span>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => setStep("upload")}
              className="flex-1 py-2 rounded-lg border border-[#002D09]/15 text-sm hover:bg-[#F7F8F4]"
            >
              {t.menu.back}
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || validRows.length === 0}
              className="flex-1 py-2 rounded-lg bg-[#E7FF00] text-[#002D09] text-sm font-medium hover:brightness-105 disabled:opacity-50"
            >
              {loading ? t.menu.importing : t.menu.importConfirm(validRows.length)}
            </button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="flex flex-col gap-4 items-center text-center py-2">
          <p className="text-sm text-[#343233]/80">
            {t.menu.importDonePrefix}
            <strong>{result.created}</strong>
            {t.menu.importDoneSuffix}
            {result.categoriesCreated > 0 ? t.menu.importCategoriesCreated(result.categoriesCreated) : ""}.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2.5 rounded-lg bg-[#E7FF00] text-[#002D09] text-sm font-semibold hover:brightness-105"
          >
            {t.menu.viewUpdatedMenu}
          </button>
        </div>
      )}
    </ModalShell>
  );
}
