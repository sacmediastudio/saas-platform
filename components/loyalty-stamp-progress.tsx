import { Stamp } from "lucide-react";

// Sellos como fila de íconos — llenos para los que ya tiene, con
// solo el contorno para los que faltan, en vez de un número suelto.
// Compartido entre /loyalty/[slug] (consulta por correo) y
// /loyalty/[slug]/tap (el toque de NFC en la caja), para que las 2
// pantallas se vean consistentes entre sí.
export default function LoyaltyStampProgress({ stamps, visitsNeeded }: { stamps: number; visitsNeeded: number }) {
  return (
    <div className="flex justify-center gap-2 flex-wrap">
      {Array.from({ length: visitsNeeded }).map((_, i) => (
        <div
          key={i}
          className={`w-9 h-9 rounded-full border-2 flex items-center justify-center ${
            i < stamps ? "bg-[#E7FF00] border-[#E7FF00]" : "border-neutral-300"
          }`}
        >
          <Stamp size={16} className={i < stamps ? "text-[#002D09]" : "text-neutral-300"} aria-hidden />
        </div>
      ))}
    </div>
  );
}
