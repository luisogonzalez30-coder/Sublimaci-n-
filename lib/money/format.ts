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
