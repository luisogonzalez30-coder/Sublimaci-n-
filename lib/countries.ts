/**
 * Presets por país para el onboarding. Son solo valores iniciales: la fuente de verdad
 * posterior es siempre `workspaces` (country_code, currency_code, tax_rate_pct).
 */
export interface CountryPreset {
  code: string;
  nombre: string;
  prefix: string;
  currency: string;
  taxRatePct: number;
  taxLabel: string;
  locale: string;
  /** Costos de referencia opcionales para precargar insumos (solo donde los conocemos). */
  seedCosts?: { tazon: number; dtfCm: number; caja: number };
}

export const COUNTRIES: readonly CountryPreset[] = [
  { code: "CL", nombre: "Chile", prefix: "+56", currency: "CLP", taxRatePct: 19, taxLabel: "IVA", locale: "es-CL",
    seedCosts: { tazon: 1500, dtfCm: 90, caja: 450 } },
  { code: "MX", nombre: "México", prefix: "+52", currency: "MXN", taxRatePct: 16, taxLabel: "IVA", locale: "es-MX" },
  { code: "CO", nombre: "Colombia", prefix: "+57", currency: "COP", taxRatePct: 19, taxLabel: "IVA", locale: "es-CO" },
  { code: "AR", nombre: "Argentina", prefix: "+54", currency: "ARS", taxRatePct: 21, taxLabel: "IVA", locale: "es-AR" },
  { code: "PE", nombre: "Perú", prefix: "+51", currency: "PEN", taxRatePct: 18, taxLabel: "IGV", locale: "es-PE" },
] as const;

export const PHONE_PREFIXES = COUNTRIES.map((c) => ({ prefix: c.prefix, label: `${c.nombre} (${c.prefix})`, code: c.code }));

export function getCountry(code: string | null | undefined): CountryPreset {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0]!;
}

export function countryFromWhatsapp(whatsapp: string | null | undefined): CountryPreset {
  const w = whatsapp ?? "";
  return COUNTRIES.find((c) => w.startsWith(c.prefix)) ?? COUNTRIES[0]!;
}
