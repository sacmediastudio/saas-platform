"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

function UnsubscribeInner() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customerId");
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    if (!customerId) {
      setStatus("error");
      return;
    }
    fetch("/api/public/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId }),
    })
      .then((r) => (r.ok ? setStatus("done") : setStatus("error")))
      .catch(() => setStatus("error"));
  }, [customerId]);

  return (
    <div className="max-w-sm mx-auto min-h-screen flex flex-col items-center justify-center px-6 text-center">
      {status === "loading" && <p className="text-sm opacity-60">Procesando...</p>}
      {status === "done" && (
        <>
          <CheckCircle2 size={40} className="text-green-600 mb-4" aria-hidden />
          <p className="text-lg font-semibold mb-1">Listo, te diste de baja</p>
          <p className="text-sm opacity-60">No vas a recibir más correos de campañas.</p>
        </>
      )}
      {status === "error" && (
        <>
          <XCircle size={40} className="text-red-500 mb-4" aria-hidden />
          <p className="text-lg font-semibold mb-1">No se pudo procesar</p>
          <p className="text-sm opacity-60">El link parece inválido o ya expiró.</p>
        </>
      )}
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeInner />
    </Suspense>
  );
}
