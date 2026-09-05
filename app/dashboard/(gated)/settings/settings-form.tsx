"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, LogOut, Check } from "lucide-react";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { TIMEZONES } from "@/lib/timezone";
import { useDashboardLang } from "@/lib/dashboard-lang-context";
import { uploadImage } from "@/lib/upload-image";
import DashboardCard from "@/components/dashboard-card";

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
  alertLanguage: string;
  currency: string;
  secondaryCurrencyCode: string | null;
  secondaryCurrencyRate: number | null;
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
  googleMapsUrl: string | null;
}

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
        let message = t.settingsForm.genericSaveError;
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
      setError(t.settingsForm.genericError);
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
    form.businessType === "SMARTLINK" ? t.settingsForm.heroLabelSmartlink : t.settingsForm.heroLabelRestaurant;

  return (
    <div className="max-w-lg">
      <DashboardCard>
      <h1 className="text-xl font-semibold mb-1">{t.settings.title}</h1>
      <p className="text-sm text-[#343233]/70 mb-6">{t.settings.subtitle}</p>

      <Section title={t.settingsForm.profileSection}>
        <Field label={t.settingsForm.businessName}>
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
              ? t.settingsForm.taglineLabelSmartlink
              : t.settingsForm.taglineLabelRestaurant
          }
        >
          <textarea
            value={form.heroTagline ?? ""}
            onChange={(e) => setForm({ ...form, heroTagline: e.target.value })}
            rows={2}
            maxLength={200}
            placeholder={
              form.businessType === "SMARTLINK"
                ? t.settingsForm.taglinePlaceholderSmartlink
                : t.settingsForm.taglinePlaceholderRestaurant
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
              {t.settingsForm.showDishPhotos}{" "}
              <span className="text-[#343233]/60">{t.settingsForm.showDishPhotosNote}</span>
            </span>
          </label>
        )}
      </Section>

      <Section title={t.settingsForm.contactSection}>
        <Field label={t.settingsForm.email}>
          <input
            type="email"
            value={form.contactEmail ?? ""}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            placeholder={t.settingsForm.emailPlaceholder}
            className={inputClass}
          />
        </Field>
        <Field label={t.settingsForm.phone}>
          <input
            value={form.contactPhone ?? ""}
            onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            placeholder="+1 555 123 4567"
            className={inputClass}
          />
        </Field>
        <Field label={t.settingsForm.address}>
          <input
            value={form.address ?? ""}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder={t.settingsForm.addressPlaceholder}
            className={inputClass}
          />
        </Field>
        <Field label={t.settingsForm.alertLanguageLabel}>
          <select
            value={form.alertLanguage}
            onChange={(e) => setForm({ ...form, alertLanguage: e.target.value })}
            className={inputClass}
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
          <span className="text-xs text-[#343233]/50 mt-1 block">{t.settingsForm.alertLanguageHint}</span>
        </Field>
      </Section>

      <Section title={t.settingsForm.currencySection}>
        <Field label={t.settingsForm.currencyLabel}>
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

        <label className="flex items-center gap-3 mt-4">
          <input
            type="checkbox"
            checked={Boolean(form.secondaryCurrencyCode)}
            onChange={(e) =>
              setForm({
                ...form,
                secondaryCurrencyCode: e.target.checked ? "AWG" : null,
                secondaryCurrencyRate: e.target.checked ? (form.secondaryCurrencyRate ?? 1.79) : null,
              })
            }
            className="w-4 h-4 accent-[#E7FF00]"
          />
          <span className="text-sm font-medium">{t.settingsForm.secondCurrencyToggle}</span>
        </label>

        {form.secondaryCurrencyCode && (
          <div className="flex flex-wrap gap-4 mt-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[#343233]/70">{t.settingsForm.secondCurrencyLabel}</span>
              <select
                value={form.secondaryCurrencyCode}
                onChange={(e) => setForm({ ...form, secondaryCurrencyCode: e.target.value })}
                className="bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none"
              >
                {SUPPORTED_CURRENCIES.filter((c) => c !== form.currency).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[#343233]/70">
                {t.settingsForm.secondCurrencyRateLabel(form.secondaryCurrencyCode, form.currency)}
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.secondaryCurrencyRate ?? ""}
                onChange={(e) => setForm({ ...form, secondaryCurrencyRate: Number(e.target.value) })}
                placeholder="1.79"
                className="bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none w-32"
              />
            </label>
          </div>
        )}
        <p className="text-xs text-[#343233]/50 mt-3 max-w-md">{t.settingsForm.secondCurrencyHint}</p>
      </Section>

      <Section title={t.settingsForm.timezoneSection}>
        <Field label={t.settingsForm.timezoneLabel}>
          <select
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            className={inputClass}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {t.timezones[tz as keyof typeof t.timezones] ?? tz}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title={t.settingsForm.appearanceSection}>
        <div className="grid grid-cols-2 gap-4">
          <ColorField
            label={t.settingsForm.background}
            value={form.themeBgColor}
            onChange={(v) => setForm({ ...form, themeBgColor: v })}
          />
          <ColorField
            label={t.settingsForm.text}
            value={form.themeTextColor}
            onChange={(v) => setForm({ ...form, themeTextColor: v })}
          />
          <ColorField
            label={t.settingsForm.buttons}
            value={form.buttonColor}
            onChange={(v) => setForm({ ...form, buttonColor: v })}
          />
          <ColorField
            label={t.settingsForm.buttonText}
            value={form.buttonTextColor}
            onChange={(v) => setForm({ ...form, buttonTextColor: v })}
          />
          <ColorField
            label={t.settingsForm.menuCards}
            value={form.menuCardColor}
            onChange={(v) => setForm({ ...form, menuCardColor: v })}
          />
          <ColorField
            label={t.settingsForm.textOnBackground}
            value={form.menuPageTextColor}
            onChange={(v) => setForm({ ...form, menuPageTextColor: v })}
          />
        </div>

        <div
          className="rounded-xl border border-[#002D09]/10 px-4 py-4 flex items-center justify-between gap-3"
          style={{ backgroundColor: form.themeBgColor, color: form.themeTextColor }}
        >
          <span className="text-sm">{t.settingsForm.previewPageLabel}</span>
          <span
            className="text-xs font-semibold px-3.5 py-2 rounded-full"
            style={{ backgroundColor: form.buttonColor, color: form.buttonTextColor }}
          >
            {t.settingsForm.previewButtonLabel}
          </span>
        </div>

        <div
          className="rounded-xl px-4 py-3 mt-3"
          style={{ backgroundColor: form.themeBgColor, color: form.menuPageTextColor }}
        >
          <span className="text-xs font-semibold tracking-[0.15em] uppercase opacity-70">
            {t.settingsForm.previewFeaturedLabel}
          </span>
        </div>

        <div
          className="rounded-2xl px-4 py-4 mt-3 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.12)]"
          style={{ backgroundColor: form.menuCardColor, color: form.themeTextColor }}
        >
          <span className="text-sm">{t.settingsForm.previewCardLabel}</span>
        </div>
      </Section>

      {enabledModules.includes("RESTAURANT") && (
        <Section title="Zertoo Eats">
          <p className="text-sm text-[#343233]/60 -mt-2 mb-4">{t.settingsForm.zertooEatsDescription}</p>
          <label className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              checked={form.nowEnabled}
              onChange={(e) => setForm({ ...form, nowEnabled: e.target.checked })}
              className="w-4 h-4 accent-[#E7FF00]"
            />
            <span className="text-sm font-medium">{t.settingsForm.appearOnZertooEats}</span>
          </label>

          {form.nowEnabled && (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 max-w-xs">
                <span className="text-xs text-[#343233]/70">{t.settingsForm.categoryLabel}</span>
                <select
                  value={form.nowCategory ?? ""}
                  onChange={(e) => setForm({ ...form, nowCategory: e.target.value || null })}
                  required
                  className="bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none"
                >
                  <option value="" disabled>
                    {t.settingsForm.chooseCategoryDefault}
                  </option>
                  {Object.entries(t.nowCategories).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-[#343233]/70">{t.settingsForm.googleMapsLabel}</span>
                <input
                  type="url"
                  value={form.googleMapsUrl ?? ""}
                  onChange={(e) => setForm({ ...form, googleMapsUrl: e.target.value || null })}
                  placeholder="https://maps.app.goo.gl/..."
                  className="bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none max-w-md"
                />
                <span className="text-xs text-[#343233]/50">{t.settingsForm.googleMapsHint}</span>
              </label>
            </div>
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
  const { t } = useDashboardLang();
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
          {uploading ? t.settingsForm.imageProcessing : value ? t.settingsForm.imageChange : t.settingsForm.imageUpload}
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
            {t.settingsForm.imageRemove}
          </button>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "w-full bg-white border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#002D09]/40";
