"use client";

import { useState } from "react";
import { Plus, Trash2, X, Users, Copy, Check } from "lucide-react";
import DashboardCard from "@/components/dashboard-card";
import { useDashboardLang } from "@/lib/dashboard-lang-context";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "STAFF";
  createdAt: string | Date;
}

export default function TeamView({
  initialStaff,
  currentUserId,
}: {
  initialStaff: StaffMember[];
  currentUserId: string;
}) {
  const { t } = useDashboardLang();
  const [staff, setStaff] = useState(initialStaff);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<{ email: string; url: string } | null>(null);

  async function removeStaff(member: StaffMember) {
    if (!confirm(t.team.confirmRemove(member.name))) return;
    setBusy(member.id);
    const res = await fetch(`/api/tenant/staff/${member.id}`, { method: "DELETE" });
    if (res.ok) setStaff((list) => list.filter((s) => s.id !== member.id));
    setBusy(null);
  }

  return (
    <div>
      <DashboardCard>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Users size={20} aria-hidden />
              {t.team.title}
            </h1>
            <p className="text-sm text-[#343233]/70 mt-1">{t.team.subtitle}</p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 text-sm font-medium bg-[#E7FF00] text-[#002D09] px-3.5 h-9 rounded-lg hover:brightness-105"
          >
            <Plus size={16} aria-hidden />
            {t.team.addMember}
          </button>
        </div>

        <div className="flex flex-col gap-2 mt-6">
          {staff.map((member) => (
            <div key={member.id} className="border border-[#002D09]/10 rounded-lg px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">
                    {member.name}
                    {member.id === currentUserId && <span className="text-[#343233]/50 font-normal"> {t.team.you}</span>}
                  </p>
                  <p className="text-sm text-[#343233]/70 mt-0.5 truncate">{member.email}</p>
                </div>
                <span
                  className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${
                    member.role === "OWNER" ? "bg-[#002D09]/10 text-[#002D09]" : "bg-[#F7F8F4] text-[#343233]/70"
                  }`}
                >
                  {member.role === "OWNER" ? t.team.roleOwner : t.team.roleStaff}
                </span>
                {member.role === "STAFF" && (
                  <button
                    onClick={() => removeStaff(member)}
                    disabled={busy === member.id}
                    aria-label={t.team.removeLabel}
                    className="text-[#343233]/60 hover:text-red-600 shrink-0 ml-1"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </DashboardCard>

      {modalOpen && (
        <InviteModal
          onClose={() => setModalOpen(false)}
          onCreated={(member, setPasswordUrl) => {
            setStaff((prev) => [...prev, member]);
            setInviteLink({ email: member.email, url: setPasswordUrl });
            setModalOpen(false);
          }}
        />
      )}

      {inviteLink && <InviteLinkModal email={inviteLink.email} url={inviteLink.url} onClose={() => setInviteLink(null)} />}
    </div>
  );
}

function InviteModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (member: StaffMember, setPasswordUrl: string) => void;
}) {
  const { t } = useDashboardLang();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/tenant/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });

      if (!res.ok) {
        let message = t.team.saveFailed;
        try {
          const body = await res.json();
          if (typeof body.error === "string") message = body.error;
        } catch {}
        setError(message);
        setSaving(false);
        return;
      }

      const body = await res.json();
      onCreated(body.staff, body.setPasswordUrl);
    } catch {
      setError(t.team.genericError);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-[#002D09]/10 rounded-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">{t.team.addTitle}</h2>
          <button onClick={onClose} aria-label={t.common.cancel} className="text-[#343233]/60 hover:text-[#002D09]">
            <X size={18} aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[#343233]/70">{t.team.name}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              placeholder={t.team.namePlaceholder}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-[#343233]/70">{t.team.email}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={t.team.emailPlaceholder}
              className={inputClass}
            />
          </label>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <p className="text-xs text-[#343233]/60">{t.team.addHint}</p>

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
              {saving ? t.team.saving : t.team.add}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InviteLinkModal({ email, url, onClose }: { email: string; url: string; onClose: () => void }) {
  const { t } = useDashboardLang();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-[#002D09]/10 rounded-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">{t.team.inviteSentTitle}</h2>
          <button onClick={onClose} aria-label={t.common.cancel} className="text-[#343233]/60 hover:text-[#002D09]">
            <X size={18} aria-hidden />
          </button>
        </div>

        <p className="text-sm text-[#343233]/70 mb-3">{t.team.inviteSentBody(email)}</p>

        <div className="flex items-center gap-2 bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2">
          <span className="text-xs text-[#343233]/70 truncate flex-1">{url}</span>
          <button onClick={copy} aria-label={t.team.copyLink} className="text-[#343233]/60 hover:text-[#002D09] shrink-0">
            {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 py-2 rounded-lg bg-[#E7FF00] text-[#002D09] text-sm font-medium hover:brightness-105"
        >
          {t.common.close}
        </button>
      </div>
    </div>
  );
}

const inputClass =
  "w-full bg-[#F7F8F4] border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#002D09]/40";
