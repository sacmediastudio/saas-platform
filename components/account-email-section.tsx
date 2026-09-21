"use client";

import { useState } from "react";
import { useDashboardLang } from "@/lib/dashboard-lang-context";

type Step = "idle" | "editing" | "codeSent";

export default function AccountEmailSection({
  initialEmail,
  initialPendingEmail,
}: {
  initialEmail: string;
  initialPendingEmail: string | null;
}) {
  const { t } = useDashboardLang();
  const [email, setEmail] = useState(initialEmail);
  const [pendingEmail, setPendingEmail] = useState(initialPendingEmail);
  const [step, setStep] = useState<Step>(pendingEmail ? "codeSent" : "idle");
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function parseError(res: Response, fallback: string) {
    try {
      const body = await res.json();
      if (typeof body.error === "string") return body.error;
    } catch {}
    return fallback;
  }

  async function handleRequestChange() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/account/email-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail, currentPassword }),
      });
      if (!res.ok) {
        setError(await parseError(res, t.settingsForm.genericError));
        return;
      }
      const body = await res.json();
      setPendingEmail(body.pendingEmail);
      setStep("codeSent");
      setCurrentPassword("");
    } catch {
      setError(t.settingsForm.genericError);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmCode() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/account/email-change/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        setError(await parseError(res, t.settingsForm.genericError));
        return;
      }
      const body = await res.json();
      setEmail(body.email);
      setPendingEmail(null);
      setStep("idle");
      setNewEmail("");
      setCode("");
      setInfo(t.settingsForm.accountEmailChanged);
      setTimeout(() => setInfo(null), 4000);
    } catch {
      setError(t.settingsForm.genericError);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelPending() {
    setError(null);
    setLoading(true);
    try {
      await fetch("/api/account/email-change", { method: "DELETE" });
      setPendingEmail(null);
      setStep("idle");
      setNewEmail("");
      setCode("");
    } catch {
      setError(t.settingsForm.genericError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-7">
      <h2 className="text-sm font-semibold text-[#002D09] mb-3">{t.settingsForm.accountSection}</h2>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 flex-1 min-w-0">
          <span className="text-xs text-[#343233]/70">{t.settingsForm.currentEmailLabel}</span>
          <span className="text-sm">{email}</span>
        </label>

        {step === "idle" && (
          <button
            onClick={() => setStep("editing")}
            className="text-xs px-2.5 py-1.5 rounded-md border border-[#002D09]/15 hover:bg-[#F7F8F4] w-fit"
          >
            {t.settingsForm.changeEmailButton}
          </button>
        )}

        {step === "editing" && (
          <div className="flex flex-col gap-3 max-w-sm">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[#343233]/70">{t.settingsForm.newEmailLabel}</span>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[#343233]/70">{t.settingsForm.currentPasswordLabel}</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
              />
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRequestChange}
                disabled={loading || !newEmail || !currentPassword}
                className="text-xs px-3 py-1.5 rounded-md bg-[#002D09] text-white hover:brightness-110 disabled:opacity-50 w-fit"
              >
                {loading ? "..." : t.settingsForm.sendCodeButton}
              </button>
              <button
                onClick={() => {
                  setStep("idle");
                  setNewEmail("");
                  setCurrentPassword("");
                  setError(null);
                }}
                className="text-xs text-[#343233]/60 hover:text-red-600"
              >
                {t.settingsForm.cancelButton}
              </button>
            </div>
          </div>
        )}

        {step === "codeSent" && pendingEmail && (
          <div className="flex flex-col gap-3 max-w-sm">
            <p className="text-xs text-[#343233]/70">{t.settingsForm.codeSentMessage(pendingEmail)}</p>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[#343233]/70">{t.settingsForm.codeLabel}</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                className={`${inputClass} tracking-[0.3em]`}
              />
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={handleConfirmCode}
                disabled={loading || code.length !== 6}
                className="text-xs px-3 py-1.5 rounded-md bg-[#002D09] text-white hover:brightness-110 disabled:opacity-50 w-fit"
              >
                {loading ? "..." : t.settingsForm.confirmCodeButton}
              </button>
              <button
                onClick={handleCancelPending}
                className="text-xs text-[#343233]/60 hover:text-red-600"
              >
                {t.settingsForm.cancelButton}
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-red-600 text-xs">{error}</p>}
        {info && <p className="text-green-700 text-xs">{info}</p>}
      </div>
    </div>
  );
}

const inputClass =
  "w-full bg-white border border-[#002D09]/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#002D09]/40";
