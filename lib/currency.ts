const LOCALE_BY_CURRENCY: Record<string, string> = {
  USD: "en-US",
  EUR: "de-DE",
  MXN: "es-MX",
  COP: "es-CO",
  ARS: "es-AR",
  CLP: "es-CL",
  PEN: "es-PE",
  BRL: "pt-BR",
  AWG: "nl-AW", // florín arubeño
};

export const SUPPORTED_CURRENCIES = Object.keys(LOCALE_BY_CURRENCY);

export function formatCurrency(amount: number, currency: string = "USD"): string {
  const locale = LOCALE_BY_CURRENCY[currency] ?? "en-US";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}
