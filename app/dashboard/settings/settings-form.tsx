"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, LogOut, Check } from "lucide-react";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

interface TenantData {
  name: string;
  slug: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  heroTagline: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  currency: string;
  themeBgColor: string;
  themeTextColor: string;
}

function resizeImageToDataUrl(file: File, maxWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("No se pudo leer la imagen"));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas no soportado"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function SettingsForm({ tenant }: { tenant: TenantData }) {
  const router = useRouter();
  const [form, setForm] = useState(tenant);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"logo" | "hero" | null>(null);

  async function handleImageUpload(field: "logoUrl" | "heroImageUrl", file: File) {
    setUploading(field === "logoUrl" ? "logo" : "hero");
    try {
      const dataUrl = await resizeImageToDataUrl(file, field === "logoUrl" ? 200 : 1200);
      setForm((f) => ({ ...f, [field]: dataUrl }));
    } catch {
      setError("No se pudo procesar la imagen.");
    } finally {
      setUploading(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
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

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-1">Ajustes</h1>
      <p className="text-sm text-neutral-400 mb-6">Perfil, marca y preferencias de tu negocio</p>

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
          label="Foto principal (aparece arriba de tu página pública)"
          value={form.heroImageUrl}
          uploading={uploading === "hero"}
          onChange={(file) => handleImageUpload("heroImageUrl", file)}
          onRemove={() => setForm((f) => ({ ...f, heroImageUrl: null }))}
          shape="wide"
        />

        <Field label="Descripción corta (aparece debajo de tu nombre en el menú público)">
          <textarea
            value={form.heroTagline ?? ""}
            onChange={(e) => setForm({ ...form, heroTagline: e.target.value })}
            rows={2}
            maxLength={200}
            placeholder="Cortes a la parrilla, cócteles tropicales y la cálida hospitalidad de la isla."
            className={`${inputClass} resize-none`}
          />
        </Field>
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

      <Section title="Apariencia de tu página pública">
        <div className="flex gap-4">
          <Field label="Color de fondo">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.themeBgColor}
                onChange={(e) => setForm({ ...form, themeBgColor: e.target.value })}
                className="w-9 h-9 rounded-md border border-neutral-700 bg-transparent cursor-pointer"
              />
              <span className="text-xs text-neutral-400">{form.themeBgColor}</span>
            </div>
          </Field>
          <Field label="Color de texto">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.themeTextColor}
                onChange={(e) => setForm({ ...form, themeTextColor: e.target.value })}
                className="w-9 h-9 rounded-md border border-neutral-700 bg-transparent cursor-pointer"
              />
              <span className="text-xs text-neutral-400">{form.themeTextColor}</span>
            </div>
          </Field>
        </div>
        <div
          className="rounded-lg border border-neutral-800 px-4 py-3 text-sm"
          style={{ backgroundColor: form.themeBgColor, color: form.themeTextColor }}
        >
          Así se ve el texto sobre el fondo de tu menú público.
        </div>
      </Section>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 bg-white text-neutral-900 text-sm font-medium px-4 h-9 rounded-lg hover:bg-neutral-200 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-400">
            <Check size={14} aria-hidden /> Guardado
          </span>
        )}
      </div>

      <div className="mt-10 pt-6 border-t border-neutral-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-red-400"
        >
          <LogOut size={15} aria-hidden />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <h2 className="text-sm font-medium text-neutral-300 mb-3">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 flex-1">
      <span className="text-xs text-neutral-400">{label}</span>
      {children}
    </label>
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
      ? "w-16 h-16 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-600"
      : "w-full h-24 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-600";

  return (
    <div className="flex flex-col gap-1.5 flex-1">
      <span className="text-xs text-neutral-400">{label}</span>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className={previewClass} />
      ) : (
        <div className={placeholderClass}>
          <ImageIcon size={20} aria-hidden />
        </div>
      )}
      <div className="flex gap-3">
        <label className="text-xs px-2.5 py-1.5 rounded-md border border-neutral-700 hover:bg-neutral-800 cursor-pointer w-fit">
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
          <button onClick={onRemove} className="text-xs text-neutral-500 hover:text-red-400">
            Quitar
          </button>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-500";
