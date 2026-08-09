"use client";

import { createContext, useContext } from "react";
import { dashboardTranslations, type DashLang } from "@/lib/i18n-dashboard";

interface DashboardLangContextValue {
  lang: DashLang;
  setLang: (l: DashLang) => void;
  t: (typeof dashboardTranslations)["en"];
}

export const DashboardLangContext = createContext<DashboardLangContextValue>({
  lang: "es",
  setLang: () => {},
  t: dashboardTranslations.es,
});

/** Cualquier página/componente del dashboard puede llamar esto para
 * obtener el idioma actual y su diccionario de traducciones, sin tener
 * que recibirlo por props desde cada page.tsx. */
export function useDashboardLang() {
  return useContext(DashboardLangContext);
}
