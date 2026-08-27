"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, LogOut, Check } from "lucide-react";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { TIMEZONES } from "@/lib/timezone";
import { useDashboardLang } from "@/lib/dashboard-lang-context";
import { uploadImage } from "@/lib/upload-image";
import DashboardCard from "@/components/dashboard-card";

const TIMEZONE_LABELS: Record<string, string> = {
  "America/Aruba": "Aruba (AST, UTC-4)",
  "America/New_York": "Nueva York (EST/EDT)",
  "America/Chicago": "Chicago (CST/CDT)",
  "America/Denver": "Denver (MST/MDT)",
  "America/Los_Angeles": "Los Ángeles (PST/PDT)",
  "America/Mexico_City": "Ciudad de México",
  "America/Bogota": "Bogotá",
  "America/Lima": "Lima",
  "America/Santiago": "Santiago de Chile",
  "America/Argentina/Buenos_Aires": "Buenos Aires",
  "America/Sao_Paulo": "São Paulo",
  "Europe/Madrid": "Madrid",
  "Europe/London": "Londres",
  UTC: "UTC",
};

interface TenantData {
  name: string;
  slug: string;
  businessType: "RESTAURANT" | "SMALL_BUSINESS" | "SMARTLINK";
  logoUrl: string | null;
  heroImageUrl: string | null;
  heroTagline: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  currency: string;
  timezone: string;
  themeBgColor: string;
  themeTextColor: string;
  buttonColor: string;
  buttonTextColor: string;
  menuCardColor: string;
  menuPageTextColor: string;
  menuShowPhotos: boolean;
  nowEnabled: boolean;
  nowCategory: string | null;
}

// Misma lista que usa Zertoo Eats — lista fija armada por Zertoo, el
// negocio elige UNA de acá (evita "italiana"/"Italian food"/"comida
// italiana" como 3 valores distintos para lo mismo). Solo restaurantes
// — Zertoo Eats quedó enfocado exclusivamente ahí, no en Citas/Smartlink.
const NOW_CATEGORY_LABELS: Record<string, string> = {
  ITALIAN: "Italiana",
  FRENCH: "Francesa",
  INTERNATIONAL: "Internacional",
  ASIAN: "Asiática",
  CRIOLLA: "Criolla",
  STEAKHOUSE: "Steakhouse",
  SEAFOOD: "Mariscos",
  FAST_FOOD: "Comida rápida",
  CAFE_DESSERTS: "Café y postres",
  PIZZERIA: "Pizzería",
  SUSHI: "Sushi",
  BAR_PUB: "Bar",
  VEGETARIAN: "Vegetariana",
};

export default function SettingsForm({
  tenant,
  enabledModules,
}: {
  tenant: TenantData;
  enabledModules: ("RESTAURANT" | "SMALL_BUSINESS" | "SMARTLINK")[];
}) {
  const { t } = useDashboardLang();
  const router = useRouter();
  const [form, setForm] = useState(tenant);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"logo" | "hero" | null>(null);

  async function handleImageUpload(field: "logoUrl" | "heroImageUrl", file: File) {
    setUploading(field === "logoUrl" ? "logo" : "hero");
    try {
      const publicUrl = await uploadImage(file, field === "logoUrl" ? 200 : 1600);
      setForm((f) => ({ ...f, [field]: publicUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la imagen.");
    } finally {
      setUploading(null);
    }
  }

  async function handleSave() {
    setError(null);
    if (form.nowEnabled && !form.nowCategory) {
      setError("Elegí una categoría para aparecer en Zertoo Eats.");
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/tenant/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        let message = "No se pudieron guardar los cambios";
        try {
          const body = await res.json();
          if (typeof body.error === "string") message = body.error;
        } catch {}
        setError(message);
        setSaving(false);
        return;
      }
      setSaved(true);
      router.refresh(); // el nombre del negocio se usa en el sidebar
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const heroLabel =
    form.businessType === "SMARTLINK"
      ? "Imagen de fondo (cubre toda tu página de Smartlink)"
      : "Foto principal (aparece arriba de tu página pública)";

  return (
    <div className="max-w-lg">
      <DashboardCard>
      <h1 className="text-xl font-semibold mb-1">{t.settings.title}</h1>
      <p className="text-sm text-[#343233]/70 mb-6">{t.settings.subtitle}</p>

      <Section title="Perfil del negocio">
        <Field label="Nombre del negocio">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
          />
        </Field>

        <div className="flex gap-4">
          <ImageField
            label="Logo"
            value={form.logoUrl}
            uploading={uploading === "logo"}
            onChange={(file) => handleImageUpload("logoUrl", file)}
            onRemove={() => setForm((f) => ({ ...f, logoUrl: null }))}
            shape="square"
          />
        </div>

        <ImageField
          label={heroLabel}
          value={form.heroImageUrl}
          uploading={uploading === "hero"}
          onChange={(file) => handleImageUpload("heroImageUrl", file)}
          onRemove={() => setForm((f) => ({ ...f, heroImageUrl: null }))}
          shape="wide"
        />

        <Field
          label={
            form.businessType === "SMARTLINK"
              ? "Descripción corta (aparece debajo de tu nombre)"
              : "Descripción corta (aparece debajo de tu nombre en el menú público)"
          }
        >
          <textarea
            value={form.heroTagline ?? ""}
            onChange={(e) => setForm({ ...form, heroTagline: e.target.value })}
            rows={2}
            maxLength={200}
            placeholder={
              form.businessType === "SMARTLINK"
                ? "Diseñadora gráfica y fotógrafa en Buenos Aires."
                : "Cortes a la parrilla, cócteles tropicales y la cálida hospitalidad de la isla."
            }
            className={`${inputClass} resize-none`}
          />
        </Field>

        {form.businessType === "RESTAURANT" && (
          <label className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.menuShowPhotos}
              onChange={(e) => setForm({ ...form, menuShowPhotos: e.target.checked })}
              className="w-4 h-4 accent-[#E7FF00]"
            />
            <span>
              Mostrar la foto de cada plato en la lista del menú{" "}
              <span className="text-[#343233]/60">(no solo en Destacados)</span>
            </span>
          </label>
        )}
      </Section>

      <Section title="Contacto">
        <Field label="Correo">
          <input
            type="email"
            value={form.contactEmail ?? ""}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            placeholder="contacto@tunegocio.com"
            className={inputClass}
          />
        </Field>
        <Field label="Teléfono">
          <input
            value={form.contactPhone ?? ""}
            onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            placeholder="+1 555 123 4567"
            className={inputClass}
          />
        </Field>
        <Field label="Dirección">
          <input
            value={form.address ?? ""}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Calle 123, Ciudad"
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Moneda">
        <Field label="Moneda de tus precios">
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className={inputClass}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Zona horaria">
        <Field label="Zona horaria de tu negocio (importante para el módulo de Citas)">
          <select
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            className={inputClass}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {TIMEZONE_LABELS[tz] ?? tz}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Apariencia de tu página pública">
        <div className="grid grid-cols-2 gap-4">
          <ColorField
            label="Fondo"
            value={form.themeBgColor}
            onChange={(v) => setForm({ ...form, themeBgColor: v })}
          />
          <ColorField
            label="Texto"
            value={form.themeTextColor}
            onChange={(v) => setForm({ ...form, themeTextColor: v })}
          />
          <ColorField
            label="Botones"
            value={form.buttonColor}
            onChange={(v) => setForm({ ...form, buttonColor: v })}
          />
          <ColorField
            label="Texto del botón"
            value={form.buttonTextColor}
            onChange={(v) => setForm({ ...form, buttonTextColor: v })}
          />
          <ColorField
            label="Tarjetas del menú"
            value={form.menuCardColor}
            onChange={(v) => setForm({ ...form, menuCardColor: v })}
          />
          <ColorField
            label="Texto sobre el fondo"
            value={form.menuPageTextColor}
            onChange={(v) => setForm({ ...form, menuPageTextColor: v })}
          />
        </div>

        <div
          className="rounded-xl border border-[#002D09]/10 px-4 py-4 flex items-center justify-between gap-3"
          style={{ backgroundColor: form.themeBgColor, color: form.themeTextColor }}
        >
          <span className="text-sm">Así se ve tu página pública</span>
          <span
            className="text-xs font-semibold px-3.5 py-2 rounded-full"
            style={{ backgroundColor: form.buttonColor, color: form.buttonTextColor }}
          >
            Botón
          </span>
        </div>

        <div
          className="rounded-xl px-4 py-3 mt-3"
          style={{ backgroundColor: form.themeBgColor, color: form.menuPageTextColor }}
        >
          <span className="text-xs font-semibold tracking-[0.15em] uppercase opacity-70">
            Así se ve "Destacados" y el menú de categorías, directo sobre el fondo
          </span>
        </div>

        <div
          className="rounded-2xl px-4 py-4 mt-3 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.12)]"
          style={{ backgroundColor: form.menuCardColor, color: form.themeTextColor }}
        >
          <span className="text-sm">Así se ve una tarjeta del menú (categoría o destacado)</span>
        </div>
      </Section>

      {enabledModules.includes("RESTAURANT") && (
        <Section title="Zertoo Eats">
          <p className="text-sm text-[#343233]/60 -mt-2 mb-4">
            El directorio de restaurantes de Zertoo — si activás esto, tu menú aparece ahí para que
            la gente te descubra. Solo para negocios con Menú activo.
          </p>
          <label className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              checked={form.nowEnabled}
              onChange={(e) => setForm({ ...form, nowEnabled: e.target.checked })}
              className="w-4 h-4 accent-[#E7FF00]"
            />
            <span className="text-sm font-medium">Aparecer en Zertoo Eats</span>
          </label>

          {form.nowEnabled && (
            <label className="flex flex-col gap-1.5 max-w-xs">
              <span className="text-xs text-[#343233]/70">Categoría</span>
              <select
                value={form.nowCategory ?? ""}
                onChange={(e) => setForm({ ...form, nowCategory: e.target.value || null })}
                required
                className="bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none"
              >
                <option value="" disabled>
                  Elegí una categoría
                </option>
                {Object.entries(NOW_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </Section>
      )}

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 bg-[#E7FF00] text-[#002D09] text-sm font-semibold px-5 h-10 rounded-full hover:brightness-105 disabled:opacity-50"
        >
          {saving ? "..." : t.settings.save}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-700">
            <Check size={14} aria-hidden /> {t.settings.saved}
          </span>
        )}
      </div>

      <div className="mt-10 pt-6 border-t border-[#002D09]/[0.08]">
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-[#343233]/70 hover:text-red-600"
        >
          <LogOut size={15} aria-hidden />
          {t.settings.logout}
        </button>
      </div>
      </DashboardCard>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <h2 className="text-sm font-semibold text-[#002D09] mb-3">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 flex-1 min-w-0">
      <span className="text-xs text-[#343233]/70">{label}</span>
      {children}
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded-md border border-[#002D09]/15 bg-transparent cursor-pointer"
        />
        <span className="text-xs text-[#343233]/70">{value}</span>
      </div>
    </Field>
  );
}

function ImageField({
  label,
  value,
  uploading,
  onChange,
  onRemove,
  shape,
}: {
  label: string;
  value: string | null;
  uploading: boolean;
  onChange: (file: File) => void;
  onRemove: () => void;
  shape: "square" | "wide";
}) {
  const previewClass =
    shape === "square" ? "w-16 h-16 rounded-lg object-cover" : "w-full h-24 rounded-lg object-cover";
  const placeholderClass =
    shape === "square"
      ? "w-16 h-16 rounded-lg bg-[#F7F8F4] flex items-center justify-center text-[#343233]/40"
      : "w-full h-24 rounded-lg bg-[#F7F8F4] flex items-center justify-center text-[#343233]/40";

  return (
    <div className="flex flex-col gap-1.5 flex-1">
      <span className="text-xs text-[#343233]/70">{label}</span>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className={previewClass} />
      ) : (
        <div className={placeholderClass}>
          <ImageIcon size={20} aria-hidden />
        </div>
      )}
      <div className="flex gap-3">
        <label className="text-xs px-2.5 py-1.5 rounded-md border border-[#002D09]/15 hover:bg-[#F7F8F4] cursor-pointer w-fit">
          {uploading ? "Procesando..." : value ? "Cambiar" : "Subir"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onChange(file);
            }}
          />
        </label>
        {value && (
          <button onClick={onRemove} className="text-xs text-[#343233]/60 hover:text-red-600">
            Quitar
          </button>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "w-full bg-white border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#002D09]/40";
