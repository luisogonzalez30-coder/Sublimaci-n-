import { getCountry } from "@/lib/countries";

/** Contexto monetario del workspace. Nunca construir uno con valores literales fuera de tests. */
export interface MoneyContext {
  currency_code: string;
  country_code: string;
}

export function formatMoney(amount: number | null | undefined, ctx: MoneyContext): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat(getCountry(ctx.country_code).locale, {
    style: "currency",
    currency: ctx.currency_code,
  }).format(amount);
}

export function formatPct(n: number): string {
  return `${new Intl.NumberFormat("es", { maximumFractionDigits: 2 }).format(n)}%`;
}

/** Decimales de la moneda según Intl (CLP/COP = 0, MXN/ARS/PEN/USD = 2). */
export function currencyDecimals(currency: string): number {
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/** Redondea hacia ARRIBA a los decimales de la moneda (así un precio nunca queda bajo el costo). */
export function ceilMoney(amount: number, currency: string): number {
  const f = 10 ** currencyDecimals(currency);
  return Math.ceil(Math.round(amount * f * 1e6) / 1e6) / f;
}

/** Redondeo comercial a los decimales de la moneda. */
export function roundMoney(amount: number, currency: string): number {
  const f = 10 ** currencyDecimals(currency);
  return Math.round((amount + Number.EPSILON) * f) / f;
}
