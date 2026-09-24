import type { Lang } from "@/lib/i18n-landing";

export default function LangSwitch({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="flex items-center rounded-full border border-forest/15 p-0.5 text-xs font-bold">
      {(["EN", "ES"] as const).map((l) => {
        const value = l.toLowerCase() as Lang;
        const active = lang === value;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(value)}
            className={`px-2.5 py-1 rounded-full transition-colors ${active ? "bg-forest text-white" : "text-forest/60"}`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
