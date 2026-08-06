"use client";

import { useEffect, useState } from "react";
import { Plus, Lock, X } from "lucide-react";

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
  PENDING: { label: "Pendiente", className: "bg-amber-950 text-amber-400" },
  CONFIRMED: { label: "Confirmada", className: "bg-green-950 text-green-400" },
  CANCELLED: { label: "Cancelada", className: "bg-red-950 text-red-400" },
  COMPLETED: { label: "Completada", className: "bg-neutral-800 text-neutral-400" },
};

export default function BookingsView({ initialBookings }: { initialBookings: BookingRow[] }) {
  const [bookings, setBookings] = useState(initialBookings);
  const [updating, setUpdating] = useState<string | null>(null);
  const [modal, setModal] = useState<"none" | "booking" | "block">("none");
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);

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
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-xl font-semibold">Agenda de hoy</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setModal("block")}
            className="flex items-center gap-1.5 text-sm font-medium border border-neutral-700 px-3 h-9 rounded-lg hover:bg-neutral-800"
          >
            <Lock size={15} aria-hidden />
            Bloquear horario
          </button>
          <button
            onClick={() => setModal("booking")}
            className="flex items-center gap-1.5 text-sm font-medium bg-white text-neutral-900 px-3.5 h-9 rounded-lg hover:bg-neutral-200"
          >
            <Plus size={16} aria-hidden />
            Nueva cita
          </button>
        </div>
      </div>
      <p className="text-sm text-neutral-400 mb-6">
        {bookings.length} citas · {confirmedCount} confirmadas
      </p>

      {bookings.length === 0 && (
        <p className="text-sm text-neutral-500">No hay citas agendadas para hoy.</p>
      )}

      <div className="border border-neutral-800 rounded-lg overflow-hidden divide-y divide-neutral-800">
        {bookings.map((b) => {
          const s = statusStyles[b.status];
          return (
            <div key={b.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <span className="text-sm text-neutral-400 w-14">
                {new Date(b.datetime).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{b.serviceName}</p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {b.customerName}
                  {b.staffName ? ` · con ${b.staffName}` : ""}
                </p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${s.className}`}>{s.label}</span>
              {b.status === "PENDING" && (
                <button
                  onClick={() => updateStatus(b.id, "CONFIRMED")}
                  disabled={updating === b.id}
                  className="text-xs px-2.5 py-1 rounded-md border border-neutral-700 hover:bg-neutral-800"
                >
                  Confirmar
                </button>
              )}
              {b.status !== "CANCELLED" && b.status !== "COMPLETED" && (
                <button
                  onClick={() => updateStatus(b.id, "CANCELLED")}
                  disabled={updating === b.id}
                  className="text-xs px-2.5 py-1 rounded-md border border-neutral-700 hover:bg-neutral-800"
                >
                  Cancelar
                </button>
              )}
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

        {error && <p className="text-red-400 text-sm">{error}</p>}

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
        <p className="text-sm text-neutral-400 mb-4">
          Ese horario ya no aparecerá disponible para nuevas reservas.
        </p>
        <button
          onClick={onClose}
          className="w-full py-2 rounded-lg bg-white text-neutral-900 text-sm font-medium"
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

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <ModalActions saving={saving} onClose={onClose} submitLabel="Bloquear" />
      </form>
    </ModalShell>
  );
}

const inputClass =
  "w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 flex-1">
      <span className="text-xs text-neutral-400">{label}</span>
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
        className="flex-1 py-2 rounded-lg border border-neutral-700 text-sm hover:bg-neutral-800"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={saving}
        className="flex-1 py-2 rounded-lg bg-white text-neutral-900 text-sm font-medium disabled:opacity-50"
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
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-neutral-500 hover:text-neutral-200">
            <X size={18} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
