"use client";

import { useState } from "react";
import { Plus, Lock, X, Copy, Check, Pencil, Trash2, Image as ImageIcon } from "lucide-react";
import TrendStatCard from "@/components/trend-stat-card";
import { formatCurrency } from "@/lib/currency";

interface BookingRow {
  id: string;
  datetime: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  customerName: string;
  serviceName: string;
  staffName: string | null;
}
interface ServiceOption {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  durationMinutes: number;
  price: number;
  staffId: string | null;
}
interface StaffOption {
  id: string;
  name: string;
}
interface TopService {
  name: string;
  count: number;
}

const statusStyles: Record<BookingRow["status"], { label: string; className: string }> = {
  PENDING: { label: "Pendiente", className: "bg-amber-50 text-amber-700" },
  CONFIRMED: { label: "Confirmada", className: "bg-green-50 text-green-700" },
  CANCELLED: { label: "Cancelada", className: "bg-red-50 text-red-700" },
  COMPLETED: { label: "Completada", className: "bg-[#F7F8F4] text-[#343233]/70" },
};

// Igual que en el módulo de menú: reduce la foto a un JPEG chico en
// base64 antes de guardarla, sin depender de un storage externo.
function resizeImageToDataUrl(file: File, maxWidth = 480): Promise<string> {
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
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function BookingsView({
  initialBookings,
  slug,
  currency,
  viewsLast7Days,
  viewsChangePercent,
  totalViews,
  totalBookings,
  bookingsLast7Days,
  avgRating,
  topServices,
  initialServices,
  initialStaff,
}: {
  initialBookings: BookingRow[];
  slug: string;
  currency: string;
  viewsLast7Days: number;
  viewsChangePercent: number | null;
  totalViews: number;
  totalBookings: number;
  bookingsLast7Days: number;
  avgRating: number | null;
  topServices: TopService[];
  initialServices: ServiceOption[];
  initialStaff: StaffOption[];
}) {
  const [bookings, setBookings] = useState(initialBookings);
  const [services, setServices] = useState(initialServices);
  const [staff] = useState(initialStaff);
  const [updating, setUpdating] = useState<string | null>(null);
  const [modal, setModal] = useState<"none" | "booking" | "block">("none");
  const [serviceModal, setServiceModal] = useState<{ mode: "create" | "edit"; service?: ServiceOption } | null>(
    null
  );
  const [copied, setCopied] = useState(false);

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/book/${slug}` : `/book/${slug}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // no crítico si el navegador bloquea el acceso al portapapeles
    }
  }

  async function updateStatus(id: string, status: BookingRow["status"]) {
    setUpdating(id);
    const prev = bookings;
    setBookings((b) => b.map((x) => (x.id === id ? { ...x, status } : x)));

    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) setBookings(prev);
    setUpdating(null);
  }

  async function deleteService(service: ServiceOption) {
    if (!confirm(`¿Borrar el servicio "${service.name}"?`)) return;
    const res = await fetch(`/api/services/${service.id}`, { method: "DELETE" });
    if (res.ok) {
      setServices((prev) => prev.filter((s) => s.id !== service.id));
    } else {
      const body = await res.json().catch(() => null);
      alert(body?.error ?? "No se pudo borrar el servicio");
    }
  }

  const confirmedCount = bookings.filter((b) => b.status === "CONFIRMED").length;

  return (
    <div>
      <div className="flex items-center gap-2 bg-[#F7F8F4] rounded-lg px-3 py-2 mb-6">
        <span className="text-sm text-[#002D09] truncate flex-1">{publicUrl}</span>
        <button onClick={copyLink} className="text-[#343233]/70 hover:text-[#002D09] shrink-0">
          {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        <TrendStatCard label="Vistas totales" value={totalViews} />
        <TrendStatCard label="Vistas (7 días)" value={viewsLast7Days} changePercent={viewsChangePercent} />
        <TrendStatCard label="Reservas (7 días)" value={bookingsLast7Days} />
        <TrendStatCard label="Citas totales" value={totalBookings} />
        <TrendStatCard label="Rating promedio" value={avgRating !== null ? avgRating.toFixed(1) : "—"} />
      </div>

      {/* --- Servicios --- */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h1 className="text-xl font-semibold">Tus servicios</h1>
        <button
          onClick={() => setServiceModal({ mode: "create" })}
          className="flex items-center gap-1.5 text-sm font-medium bg-[#E7FF00] text-[#002D09] px-3.5 h-9 rounded-lg hover:brightness-105"
        >
          <Plus size={16} aria-hidden />
          Agregar servicio
        </button>
      </div>
      <p className="text-sm text-[#343233]/70 mb-4">
        Estos son los que tus clientes ven y eligen en tu página pública.
      </p>

      {services.length === 0 ? (
        <p className="text-sm text-[#343233]/60 mb-8">Todavía no tienes servicios. Agrega el primero.</p>
      ) : (
        <div className="border border-[#002D09]/10 rounded-lg overflow-hidden divide-y divide-[#002D09]/10 mb-8">
          {services.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-3.5 py-2.5">
              {s.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.imageUrl} alt={s.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-[#F7F8F4] shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{s.name}</p>
                <p className="text-xs text-[#343233]/70 mt-0.5">{s.durationMinutes} min</p>
              </div>
              <span className="text-sm font-medium">{formatCurrency(s.price, currency)}</span>
              <button
                onClick={() => setServiceModal({ mode: "edit", service: s })}
                aria-label={`Editar ${s.name}`}
                className="text-[#343233]/60 hover:text-[#002D09]"
              >
                <Pencil size={15} aria-hidden />
              </button>
              <button
                onClick={() => deleteService(s)}
                aria-label={`Borrar ${s.name}`}
                className="text-[#343233]/60 hover:text-red-600"
              >
                <Trash2 size={15} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* --- Agenda --- */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h2 className="text-xl font-semibold">Agenda de hoy</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setModal("block")}
            className="flex items-center gap-1.5 text-sm font-medium border border-[#002D09]/15 px-3 h-9 rounded-lg hover:bg-[#F7F8F4]"
          >
            <Lock size={15} aria-hidden />
            Bloquear horario
          </button>
          <button
            onClick={() => setModal("booking")}
            className="flex items-center gap-1.5 text-sm font-medium bg-[#E7FF00] text-[#002D09] px-3.5 h-9 rounded-lg hover:brightness-105"
          >
            <Plus size={16} aria-hidden />
            Nueva cita
          </button>
        </div>
      </div>
      <p className="text-sm text-[#343233]/70 mb-6">
        {bookings.length} citas · {confirmedCount} confirmadas
      </p>

      {topServices.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-2">Servicios más reservados</h2>
          <div className="border border-[#002D09]/10 rounded-lg overflow-hidden divide-y divide-[#002D09]/10">
            {topServices.map((s) => (
              <div key={s.name} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-sm flex-1">{s.name}</span>
                <span className="text-sm font-semibold">{s.count} reserva{s.count === 1 ? "" : "s"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {bookings.length === 0 && (
        <p className="text-sm text-[#343233]/60">No hay citas agendadas para hoy.</p>
      )}

      <div className="border border-[#002D09]/10 rounded-lg overflow-hidden divide-y divide-[#002D09]/10">
        {bookings.map((b) => {
          const s = statusStyles[b.status];
          return (
            <div key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
              <div className="flex items-center gap-3 flex-1 min-w-[160px]">
                <span className="text-sm text-[#343233]/70 w-14 shrink-0">
                  {new Date(b.datetime).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{b.serviceName}</p>
                  <p className="text-xs text-[#343233]/70 mt-0.5">
                    {b.customerName}
                    {b.staffName ? ` · con ${b.staffName}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${s.className}`}>{s.label}</span>
                {b.status === "PENDING" && (
                  <button
                    onClick={() => updateStatus(b.id, "CONFIRMED")}
                    disabled={updating === b.id}
                    className="text-xs px-2.5 py-1 rounded-md border border-[#002D09]/15 hover:bg-[#F7F8F4]"
                  >
                    Confirmar
                  </button>
                )}
                {b.status !== "CANCELLED" && b.status !== "COMPLETED" && (
                  <button
                    onClick={() => updateStatus(b.id, "CANCELLED")}
                    disabled={updating === b.id}
                    className="text-xs px-2.5 py-1 rounded-md border border-[#002D09]/15 hover:bg-[#F7F8F4]"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modal === "booking" && (
        <NewBookingModal
          services={services}
          staff={staff}
          onClose={() => setModal("none")}
          onCreated={(row) => setBookings((prev) => [...prev, row].sort((a, b) => a.datetime.localeCompare(b.datetime)))}
        />
      )}
      {modal === "block" && <BlockScheduleModal staff={staff} onClose={() => setModal("none")} />}

      {serviceModal && (
        <ServiceModal
          mode={serviceModal.mode}
          service={serviceModal.service}
          staff={staff}
          onClose={() => setServiceModal(null)}
          onCreated={(s) => setServices((prev) => [...prev, s])}
          onUpdated={(s) => setServices((prev) => prev.map((x) => (x.id === s.id ? s : x)))}
        />
      )}
    </div>
  );
}

function ServiceModal({
  mode,
  service,
  staff,
  onClose,
  onCreated,
  onUpdated,
}: {
  mode: "create" | "edit";
  service?: ServiceOption;
  staff: StaffOption[];
  onClose: () => void;
  onCreated: (s: ServiceOption) => void;
  onUpdated: (s: ServiceOption) => void;
}) {
  const [form, setForm] = useState({
    name: service?.name ?? "",
    description: service?.description ?? "",
    imageUrl: (service?.imageUrl ?? null) as string | null,
    durationMinutes: service ? String(service.durationMinutes) : "60",
    price: service ? String(service.price) : "",
    staffId: service?.staffId ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessingImage(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setForm((f) => ({ ...f, imageUrl: dataUrl }));
    } catch {
      setError("No se pudo procesar la imagen. Intenta con otra foto.");
    } finally {
      setProcessingImage(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const price = Number(form.price);
    const durationMinutes = Number(form.durationMinutes);
    if (!Number.isFinite(price) || price <= 0) {
      setError("Ingresa un precio válido");
      return;
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setError("Ingresa una duración válida");
      return;
    }

    setSaving(true);
    try {
      const url = mode === "create" ? "/api/services" : `/api/services/${service!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          imageUrl: form.imageUrl,
          durationMinutes,
          price,
          staffId: form.staffId || null,
        }),
      });

      if (!res.ok) {
        let message = "No se pudo guardar el servicio";
        try {
          const body = await res.json();
          if (typeof body.error === "string") message = body.error;
        } catch {}
        setError(message);
        setSaving(false);
        return;
      }

      const { service: saved } = await res.json();
      if (mode === "create") onCreated(saved);
      else onUpdated(saved);
      onClose();
    } catch {
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
      setSaving(false);
    }
  }

  return (
    <ModalShell title={mode === "create" ? "Agregar servicio" : "Editar servicio"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Foto (opcional)">
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
                {processingImage ? "Procesando..." : "Subir foto"}
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
              {form.imageUrl && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, imageUrl: null }))}
                  className="text-xs text-[#343233]/60 hover:text-red-600 text-left"
                >
                  Quitar foto
                </button>
              )}
            </div>
          </div>
        </Field>

        <Field label="Nombre">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="Corte y color"
            className={inputClass}
          />
        </Field>

        <Field label="Descripción (opcional)">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            placeholder="Incluye lavado y peinado"
            className={`${inputClass} resize-none`}
          />
        </Field>

        <div className="flex gap-2">
          <Field label="Duración (min)">
            <input
              type="number"
              min="1"
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Precio">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
              placeholder="45.00"
              className={inputClass}
            />
          </Field>
        </div>

        {staff.length > 0 && (
          <Field label="Con quién (opcional)">
            <select
              value={form.staffId}
              onChange={(e) => setForm({ ...form, staffId: e.target.value })}
              className={inputClass}
            >
              <option value="">Cualquiera</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <ModalActions
          saving={saving || processingImage}
          onClose={onClose}
          submitLabel={mode === "create" ? "Agregar" : "Guardar cambios"}
        />
      </form>
    </ModalShell>
  );
}

function NewBookingModal({
  services,
  staff,
  onClose,
  onCreated,
}: {
  services: ServiceOption[];
  staff: StaffOption[];
  onClose: () => void;
  onCreated: (row: BookingRow) => void;
}) {
  const [form, setForm] = useState({
    serviceId: "",
    staffId: "",
    customerName: "",
    customerEmail: "",
    date: new Date().toISOString().slice(0, 10),
    time: "09:00",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedService = services.find((s) => s.id === form.serviceId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.serviceId) {
      setError("Elige un servicio");
      return;
    }
    setSaving(true);

    const datetime = new Date(`${form.date}T${form.time}:00`);

    try {
      const res = await fetch("/api/bookings/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: form.serviceId,
          staffId: form.staffId || undefined,
          customerName: form.customerName,
          customerEmail: form.customerEmail,
          datetime: datetime.toISOString(),
        }),
      });

      if (!res.ok) {
        let message = "No se pudo crear la cita";
        try {
          const body = await res.json();
          if (typeof body.error === "string") message = body.error;
        } catch {}
        setError(message);
        setSaving(false);
        return;
      }

      const { booking } = await res.json();
      onCreated({
        id: booking.id,
        datetime: booking.datetime,
        status: booking.status,
        customerName: booking.customerName,
        serviceName: selectedService?.name ?? "",
        staffName: staff.find((s) => s.id === form.staffId)?.name ?? null,
      });
      onClose();
    } catch {
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Nueva cita" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Servicio">
          <select
            value={form.serviceId}
            onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
            required
            className={inputClass}
          >
            <option value="">Selecciona un servicio</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.durationMinutes} min
              </option>
            ))}
          </select>
        </Field>

        {staff.length > 0 && (
          <Field label="Con (opcional)">
            <select
              value={form.staffId}
              onChange={(e) => setForm({ ...form, staffId: e.target.value })}
              className={inputClass}
            >
              <option value="">Cualquiera</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="flex gap-2">
          <Field label="Fecha">
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Hora">
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              required
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Nombre del cliente">
          <input
            value={form.customerName}
            onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            required
            placeholder="Ana Martínez"
            className={inputClass}
          />
        </Field>

        <Field label="Correo del cliente">
          <input
            type="email"
            value={form.customerEmail}
            onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
            required
            placeholder="name@correo.com"
            className={inputClass}
          />
        </Field>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <ModalActions saving={saving} onClose={onClose} submitLabel="Crear cita" />
      </form>
    </ModalShell>
  );
}

function BlockScheduleModal({ staff, onClose }: { staff: StaffOption[]; onClose: () => void }) {
  const [form, setForm] = useState({
    staffId: "",
    date: new Date().toISOString().slice(0, 10),
    startTime: "13:00",
    endTime: "14:00",
    reason: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const start = new Date(`${form.date}T${form.startTime}:00`);
    const end = new Date(`${form.date}T${form.endTime}:00`);
    if (end <= start) {
      setError("La hora de fin debe ser posterior al inicio");
      return;
    }
    setSaving(true);

    try {
      const res = await fetch("/api/availability-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: form.staffId || undefined,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          reason: form.reason || undefined,
        }),
      });

      if (!res.ok) {
        let message = "No se pudo crear el bloqueo";
        try {
          const body = await res.json();
          if (typeof body.error === "string") message = body.error;
        } catch {}
        setError(message);
        setSaving(false);
        return;
      }
      setDone(true);
    } catch {
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
      setSaving(false);
    }
  }

  if (done) {
    return (
      <ModalShell title="Horario bloqueado" onClose={onClose}>
        <p className="text-sm text-[#343233]/70 mb-4">
          Ese horario ya no aparecerá disponible para nuevas reservas.
        </p>
        <button
          onClick={onClose}
          className="w-full py-2 rounded-lg bg-[#E7FF00] text-[#002D09] text-sm font-medium hover:brightness-105"
        >
          Listo
        </button>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Bloquear horario" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {staff.length > 0 && (
          <Field label="Staff (opcional — vacío bloquea para todos)">
            <select
              value={form.staffId}
              onChange={(e) => setForm({ ...form, staffId: e.target.value })}
              className={inputClass}
            >
              <option value="">Todos</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Fecha">
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
            className={inputClass}
          />
        </Field>

        <div className="flex gap-2">
          <Field label="Desde">
            <input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Hasta">
            <input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              required
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Motivo (opcional)">
          <input
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Almuerzo, vacaciones, mantenimiento..."
            className={inputClass}
          />
        </Field>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <ModalActions saving={saving} onClose={onClose} submitLabel="Bloquear" />
      </form>
    </ModalShell>
  );
}

const inputClass =
  "w-full bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#002D09]/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 flex-1">
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
  return (
    <div className="flex gap-2 mt-1">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 py-2 rounded-lg border border-[#002D09]/15 text-sm hover:bg-[#F7F8F4]"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={saving}
        className="flex-1 py-2 rounded-lg bg-[#E7FF00] text-[#002D09] text-sm font-medium hover:brightness-105 disabled:opacity-50"
      >
        {saving ? "Guardando..." : submitLabel}
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
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-[#002D09]/10 rounded-xl w-full max-w-sm p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-[#343233]/60 hover:text-[#002D09]">
            <X size={18} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
