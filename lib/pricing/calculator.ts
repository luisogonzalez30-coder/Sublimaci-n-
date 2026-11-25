/**
 * Motor de costeo dinámico. Funciones puras: sin I/O, sin moneda ni impuesto
 * hardcodeados (el IVA llega siempre como `tax_rate_pct` del workspace).
 *
 * Debe mantenerse equivalente a `public.calcular_precio_sugerido` (SQL, migración 001).
 */

export interface InsumoLinea {
  cantidad_requerida: number;
  costo_unitario: number;
}

export interface PricingInput {
  items: readonly InsumoLinea[];
  merma_pct: number;
  mano_obra_fija: number;
  gastos_fijos_prorrateo: number;
  margen_objetivo_pct: number;
  aplica_iva: boolean;
  tax_rate_pct: number;
}

export interface PricingBreakdown {
  materiales: number;
  merma: number;
  mano_obra: number;
  gastos_fijos: number;
  ganancia_neta: number;
  impuesto: number;
}

export interface PricingResult {
  costo_materiales: number;
  costo_con_merma: number;
  costo_total_base: number;
  precio_neto_sugerido: number;
  impuesto: number;
  precio_final: number;
  ganancia_neta: number;
  margen_efectivo_pct: number;
  desglose: PricingBreakdown;
}

/** Tramos por volumen: descuento expresado en puntos porcentuales de margen. */
export interface VolumeTier {
  min_qty: number;
  descuento_margen_pct: number;
}

export const VOLUME_TIERS: readonly VolumeTier[] = [
  { min_qty: 1, descuento_margen_pct: 0 },
  { min_qty: 12, descuento_margen_pct: 8 },
  { min_qty: 24, descuento_margen_pct: 12 },
  { min_qty: 50, descuento_margen_pct: 15 },
] as const;

export interface VolumeRow extends VolumeTier {
  margen_efectivo_pct: number;
  precio_unitario_neto: number;
  precio_unitario_final: number;
  total_final: number;
  ganancia_unitaria: number;
  /** true si el margen del tramo llegó al piso (0 %) y el precio quedó igual al costo base. */
  limitado_por_costo: boolean;
}

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingError";
  }
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

function assertFiniteNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new PricingError(`${field} debe ser un número >= 0`);
  }
}

/** Margen sobre precio: debe estar en [0, 100). Con 100 % el precio sería infinito. */
export function assertValidMargin(margen_pct: number): void {
  if (!Number.isFinite(margen_pct) || margen_pct < 0 || margen_pct >= 100) {
    throw new PricingError("margen_objetivo_pct debe estar entre 0 y 99.99");
  }
}

function validate(input: PricingInput): void {
  assertValidMargin(input.margen_objetivo_pct);
  assertFiniteNonNegative(input.merma_pct, "merma_pct");
  assertFiniteNonNegative(input.mano_obra_fija, "mano_obra_fija");
  assertFiniteNonNegative(input.gastos_fijos_prorrateo, "gastos_fijos_prorrateo");
  assertFiniteNonNegative(input.tax_rate_pct, "tax_rate_pct");
  for (const it of input.items) {
    assertFiniteNonNegative(it.cantidad_requerida, "cantidad_requerida");
    assertFiniteNonNegative(it.costo_unitario, "costo_unitario");
  }
}

interface Core {
  materiales: number;
  conMerma: number;
  base: number;
  neto: number;
  final: number;
}

function core(input: PricingInput, margen_pct: number): Core {
  const materiales = input.items.reduce((acc, it) => acc + it.cantidad_requerida * it.costo_unitario, 0);
  const conMerma = materiales * (1 + input.merma_pct / 100);
  const base = conMerma + input.mano_obra_fija + input.gastos_fijos_prorrateo;
  // Nunca bajo el costo total base (garantizado por margen >= 0; max() lo hace explícito).
  const neto = Math.max(base / (1 - margen_pct / 100), base);
  const final = input.aplica_iva ? neto * (1 + input.tax_rate_pct / 100) : neto;
  return { materiales, conMerma, base, neto, final };
}

export function calculatePricing(input: PricingInput): PricingResult {
  validate(input);
  const c = core(input, input.margen_objetivo_pct);
  const merma = c.conMerma - c.materiales;
  const ganancia = c.neto - c.base;
  const impuesto = c.final - c.neto;
  return {
    costo_materiales: round2(c.materiales),
    costo_con_merma: round2(c.conMerma),
    costo_total_base: round2(c.base),
    precio_neto_sugerido: round2(c.neto),
    impuesto: round2(impuesto),
    precio_final: round2(c.final),
    ganancia_neta: round2(ganancia),
    margen_efectivo_pct: input.margen_objetivo_pct,
    desglose: {
      materiales: round2(c.materiales),
      merma: round2(merma),
      mano_obra: round2(input.mano_obra_fija),
      gastos_fijos: round2(input.gastos_fijos_prorrateo),
      ganancia_neta: round2(ganancia),
      impuesto: round2(impuesto),
    },
  };
}

/** Tabla de precios por volumen. Precio unitario y total ya incluyen impuesto si `aplica_iva`. */
export function calculateVolumeTable(
  input: PricingInput,
  tiers: readonly VolumeTier[] = VOLUME_TIERS,
): VolumeRow[] {
  validate(input);
  return tiers.map((tier) => {
    const margen = Math.max(0, input.margen_objetivo_pct - tier.descuento_margen_pct);
    const c = core(input, margen);
    return {
      ...tier,
      margen_efectivo_pct: round2(margen),
      precio_unitario_neto: round2(c.neto),
      precio_unitario_final: round2(c.final),
      total_final: round2(c.final * tier.min_qty),
      ganancia_unitaria: round2(c.neto - c.base),
      limitado_por_costo: margen === 0 && input.margen_objetivo_pct - tier.descuento_margen_pct < 0,
    };
  });
}

/** Tramo aplicable para una cantidad dada (el de mayor `min_qty` que no la exceda). */
export function pickTier<T extends VolumeTier>(rows: readonly T[], qty: number): T | undefined {
  return [...rows].sort((a, b) => b.min_qty - a.min_qty).find((r) => qty >= r.min_qty);
}
