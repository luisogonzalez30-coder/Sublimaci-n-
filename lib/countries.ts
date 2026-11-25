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
  /** Sitio de Mercado Pago de ese país (users/me → site_id). */
  mpSite: string;
  /** Costos de referencia (moneda local, editables) para precargar el paso 2 del onboarding. */
  seedCosts: { tazon: number; dtfCm: number; caja: number };
}

export const COUNTRIES: readonly CountryPreset[] = [
  { code: "CL", nombre: "Chile", prefix: "+56", currency: "CLP", taxRatePct: 19, taxLabel: "IVA", locale: "es-CL",
    mpSite: "MLC", seedCosts: { tazon: 1500, dtfCm: 90, caja: 450 } },
  { code: "MX", nombre: "México", prefix: "+52", currency: "MXN", taxRatePct: 16, taxLabel: "IVA", locale: "es-MX",
    mpSite: "MLM", seedCosts: { tazon: 35, dtfCm: 2.5, caja: 10 } },
  { code: "CO", nombre: "Colombia", prefix: "+57", currency: "COP", taxRatePct: 19, taxLabel: "IVA", locale: "es-CO",
    mpSite: "MCO", seedCosts: { tazon: 6000, dtfCm: 450, caja: 2000 } },
  { code: "AR", nombre: "Argentina", prefix: "+54", currency: "ARS", taxRatePct: 21, taxLabel: "IVA", locale: "es-AR",
    mpSite: "MLA", seedCosts: { tazon: 3500, dtfCm: 200, caja: 1200 } },
  { code: "PE", nombre: "Perú", prefix: "+51", currency: "PEN", taxRatePct: 18, taxLabel: "IGV", locale: "es-PE",
    mpSite: "MPE", seedCosts: { tazon: 8, dtfCm: 0.55, caja: 2 } },
] as const;

export const PHONE_PREFIXES = COUNTRIES.map((c) => ({ prefix: c.prefix, label: `${c.nombre} (${c.prefix})`, code: c.code }));

export function getCountry(code: string | null | undefined): CountryPreset {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0]!;
}

export function countryFromWhatsapp(whatsapp: string | null | undefined): CountryPreset {
  const w = whatsapp ?? "";
  return COUNTRIES.find((c) => w.startsWith(c.prefix)) ?? COUNTRIES[0]!;
}
