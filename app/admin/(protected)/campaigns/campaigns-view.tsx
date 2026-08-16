"use client";

import { useEffect, useState } from "react";
import { Megaphone, Mail, MessageCircle, AlertTriangle } from "lucide-react";
import DashboardCard from "@/components/dashboard-card";

interface Tenant {
  id: string;
  name: string;
}
interface CampaignLog {
  id: string;
  channel: string;
  subject: string | null;
  tenantFilter: string | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

export default function CampaignsView({
  tenants,
  recentCampaigns,
}: {
  tenants: Tenant[];
  recentCampaigns: CampaignLog[];
}) {
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [tenantId, setTenantId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [waTemplateName, setWaTemplateName] = useState("");
  const [waTemplateLang, setWaTemplateLang] = useState("es");
  const [waCustomParam, setWaCustomParam] = useState("");

  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ channel, ...(tenantId ? { tenantId } : {}) });
    fetch(`/api/admin/campaigns/preview?${params}`)
      .then((r) => r.json())
      .then((data) => setPreviewCount(data.count))
      .catch(() => setPreviewCount(null));
  }, [channel, tenantId]);

  async function handleSend() {
    if (!confirm(`¿Confirmas mandar esta campaña a ${previewCount ?? "?"} clientes? Esta acción no se puede deshacer.`)) {
      return;
    }
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/campaigns/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          tenantId: tenantId || null,
          subject: channel === "email" ? subject : undefined,
          message,
          whatsappTemplateName: channel === "whatsapp" ? waTemplateName : undefined,
          whatsappTemplateLang: channel === "whatsapp" ? waTemplateLang : undefined,
          whatsappCustomParam: channel === "whatsapp" ? waCustomParam : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "No se pudo enviar la campaña");
      } else {
        setResult({ sent: body.sent, failed: body.failed });
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    }
    setSending(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <DashboardCard>
        <h1 className="text-xl font-semibold mb-1 flex items-center gap-2">
          <Megaphone size={20} aria-hidden />
          Campañas
        </h1>
        <p className="text-sm text-[#343233]/70 mb-2">
          Manda un correo o WhatsApp a los clientes capturados en la plataforma (respeta a quien se
          haya dado de baja).
        </p>

        <div className="flex items-start gap-2 bg-amber-50 text-amber-800 rounded-lg px-3 py-2.5 mb-5 text-xs">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" aria-hidden />
          <p>
            <strong>Ten cuidado con esto.</strong> Estos clientes dejaron sus datos para un
            propósito puntual (reservar, reseñar, reclamar un premio) — no necesariamente dieron
            consentimiento explícito de marketing. Mandar campañas no solicitadas puede violar
            leyes de spam y, en el caso de WhatsApp específicamente, puede hacer que Meta suspenda
            la cuenta de WhatsApp Business de la plataforma. Úsalo con criterio.
          </p>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setChannel("email")}
            className={`flex items-center gap-1.5 text-sm font-medium px-3.5 h-9 rounded-lg ${channel === "email" ? "bg-[#002D09] text-white" : "border border-[#002D09]/15"}`}
          >
            <Mail size={15} aria-hidden />
            Email
          </button>
          <button
            onClick={() => setChannel("whatsapp")}
            className={`flex items-center gap-1.5 text-sm font-medium px-3.5 h-9 rounded-lg ${channel === "whatsapp" ? "bg-[#002D09] text-white" : "border border-[#002D09]/15"}`}
          >
            <MessageCircle size={15} aria-hidden />
            WhatsApp
          </button>
        </div>

        <label className="flex flex-col gap-1 mb-3">
          <span className="text-xs text-[#343233]/70">Segmento</span>
          <select
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none"
          >
            <option value="">Todos los negocios</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        {channel === "email" ? (
          <>
            <label className="flex flex-col gap-1 mb-3">
              <span className="text-xs text-[#343233]/70">Asunto</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Novedades de tu negocio favorito"
                className="bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 mb-4">
              <span className="text-xs text-[#343233]/70">Mensaje (admite HTML simple)</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder="<p>Hola! Queríamos contarte...</p>"
                className="bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none resize-none"
              />
            </label>
          </>
        ) : (
          <>
            <p className="text-xs text-[#343233]/60 mb-3">
              WhatsApp exige una plantilla de categoría <strong>Marketing</strong> ya aprobada por
              Meta — no admite texto libre para este tipo de envío.
            </p>
            <label className="flex flex-col gap-1 mb-3">
              <span className="text-xs text-[#343233]/70">Nombre de la plantilla</span>
              <input
                value={waTemplateName}
                onChange={(e) => setWaTemplateName(e.target.value)}
                placeholder="ej. promo_general"
                className="bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 mb-3">
              <span className="text-xs text-[#343233]/70">Código de idioma de la plantilla</span>
              <input
                value={waTemplateLang}
                onChange={(e) => setWaTemplateLang(e.target.value)}
                placeholder="es_CO"
                className="bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 mb-4">
              <span className="text-xs text-[#343233]/70">Texto para la variable {"{{2}}"} (la {"{{1}}"} ya es el nombre del cliente)</span>
              <input
                value={waCustomParam}
                onChange={(e) => setWaCustomParam(e.target.value)}
                placeholder="20% de descuento esta semana"
                className="bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none"
              />
            </label>
          </>
        )}

        <p className="text-sm text-[#343233]/70 mb-3">
          Le va a llegar a <strong>{previewCount ?? "..."}</strong> clientes.
        </p>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {result && (
          <p className="text-sm text-green-700 mb-3">
            Enviado: {result.sent} · Fallidos: {result.failed}
          </p>
        )}

        <button
          onClick={handleSend}
          disabled={sending || !message || (channel === "whatsapp" && !waTemplateName) || !previewCount}
          className="text-sm font-semibold px-4 h-10 rounded-lg bg-[#E7FF00] text-[#002D09] hover:brightness-105 disabled:opacity-50"
        >
          {sending ? "Enviando..." : "Enviar campaña"}
        </button>
      </DashboardCard>

      <DashboardCard>
        <h2 className="text-sm font-semibold mb-3">Últimas campañas</h2>
        {recentCampaigns.length === 0 && (
          <p className="text-sm text-[#343233]/60">Todavía no se ha mandado ninguna campaña.</p>
        )}
        <div className="border border-[#002D09]/10 rounded-lg overflow-hidden divide-y divide-[#002D09]/10">
          {recentCampaigns.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="text-xs px-2 py-1 rounded-md bg-[#F7F8F4] shrink-0">{c.channel}</span>
              <div className="flex-1 min-w-[160px]">
                <p className="text-sm font-medium">{c.subject || "(sin asunto)"}</p>
                <p className="text-xs text-[#343233]/60">
                  {c.tenantFilter ? "Un negocio" : "Todos los negocios"} · {c.sentCount}/{c.recipientCount} enviados
                </p>
              </div>
              <span className="text-xs text-[#343233]/50 shrink-0">
                {new Date(c.createdAt).toLocaleDateString("es", { day: "numeric", month: "short" })}
              </span>
            </div>
          ))}
        </div>
      </DashboardCard>
    </div>
  );
}
