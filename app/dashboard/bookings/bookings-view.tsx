"use client";

import { useEffect, useState } from "react";
import { Plus, Lock, X, Copy, Check } from "lucide-react";

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
  durationMinutes: number;
  price: number;
  staffId: string | null;
}
interface StaffOption {
  id: string;
  name: string;
}

const statusStyles: Record<BookingRow["status"], { label: string; className: string }> = {
  PENDING: { label: "Pendiente", className: "bg-amber-50 text-amber-700" },
  CONFIRMED: { label: "Confirmada", className: "bg-green-50 text-green-700" },
  CANCELLED: { label: "Cancelada", className: "bg-red-50 text-red-700" },
  COMPLETED: { label: "Completada", className: "bg-[#F7F8F4] text-[#343233]/70" },
};

export default function BookingsView({
  initialBookings,
  slug,
  viewsLast7Days,
  totalBookings,
  avgRating,
}: {
  initialBookings: BookingRow[];
  slug: string;
  viewsLast7Days: number;
  totalBookings: number;
  avgRating: number | null;
}) {
  const [bookings, setBookings] = useState(initialBookings);
  const [updating, setUpdating] = useState<string | null>(null);
  const [modal, setModal] = useState<"none" | "booking" | "block">("none");
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
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

  // Cargamos servicios y staff solo cuando se abre un modal que los
  // necesita, no en cada render del dashboard.
  useEffect(() => {
    if (modal === "none" || services.length > 0) return;
    fetch("/api/services")
      .then((r) => r.json())
      .then((data) => {
        setServices(data.services ?? []);
        setStaff(data.staff ?? []);
      });
  }, [modal, services.length]);

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

  const confirmedCount = bookings.filter((b) => b.status === "CONFIRMED").length;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h1 className="text-xl font-semibold">Agenda de hoy</h1>
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Vistas (7 días)" value={viewsLast7Days} />
        <StatCard label="Citas totales" value={totalBookings} />
        <StatCard label="Rating promedio" value={avgRating !== null ? avgRating.toFixed(1) : "—"} />
      </div>

      <div className="flex items-center gap-2 bg-[#F7F8F4] rounded-lg px-3 py-2 mb-6">
        <span className="text-sm text-[#002D09] truncate flex-1">{publicUrl}</span>
        <button onClick={copyLink} className="text-[#343233]/70 hover:text-[#002D09] shrink-0">
          {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
        </button>
      </div>

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
    </div>
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
      <div className="bg-white border border-[#002D09]/10 rounded-xl w-full max-w-sm p-5">
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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#F7F8F4] rounded-lg p-4">
      <p className="text-sm text-[#343233]/70">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}
