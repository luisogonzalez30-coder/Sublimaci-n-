import { describe, expect, it } from "vitest";
import {
  PricingError,
  calculatePricing,
  calculateVolumeTable,
  pickTier,
  type PricingInput,
} from "./calculator";

// materiales = 2*1000 + 1*500 = 2500 ; con merma 10 % = 2750 ; base = 2750 + 1000 + 250 = 4000
const base: PricingInput = {
  items: [
    { cantidad_requerida: 2, costo_unitario: 1000 },
    { cantidad_requerida: 1, costo_unitario: 500 },
  ],
  merma_pct: 10,
  mano_obra_fija: 1000,
  gastos_fijos_prorrateo: 250,
  margen_objetivo_pct: 50,
  aplica_iva: false,
  tax_rate_pct: 19,
};

describe("calculatePricing", () => {
  it("calcula materiales, merma y costo base", () => {
    const r = calculatePricing(base);
    expect(r.costo_materiales).toBe(2500);
    expect(r.costo_con_merma).toBe(2750);
    expect(r.costo_total_base).toBe(4000);
  });

  it("precio sin IVA = base / (1 - margen)", () => {
    const r = calculatePricing(base);
    expect(r.precio_neto_sugerido).toBe(8000);
    expect(r.impuesto).toBe(0);
    expect(r.precio_final).toBe(8000);
    expect(r.ganancia_neta).toBe(4000);
  });

  it("aplica tax_rate_pct del workspace solo si aplica_iva", () => {
    expect(calculatePricing({ ...base, aplica_iva: true }).precio_final).toBe(9520);
    expect(calculatePricing({ ...base, aplica_iva: true, tax_rate_pct: 16 }).precio_final).toBe(9280);
    expect(calculatePricing({ ...base, aplica_iva: false, tax_rate_pct: 16 }).precio_final).toBe(8000);
  });

  it("el desglose suma el precio neto", () => {
    const d = calculatePricing(base).desglose;
    expect(d.materiales + d.merma + d.mano_obra + d.gastos_fijos + d.ganancia_neta).toBe(8000);
    expect(d.merma).toBe(250);
  });

  it("sin merma ni costos fijos", () => {
    const r = calculatePricing({ ...base, merma_pct: 0, mano_obra_fija: 0, gastos_fijos_prorrateo: 0 });
    expect(r.costo_total_base).toBe(2500);
    expect(r.precio_neto_sugerido).toBe(5000);
  });

  it("producto sin insumos usa solo costos fijos", () => {
    const r = calculatePricing({ ...base, items: [] });
    expect(r.costo_total_base).toBe(1250);
  });

  it.each([100, 150, -1, Number.NaN, Number.POSITIVE_INFINITY])("rechaza margen %s", (m) => {
    expect(() => calculatePricing({ ...base, margen_objetivo_pct: m })).toThrow(PricingError);
    expect(() => calculateVolumeTable({ ...base, margen_objetivo_pct: m })).toThrow(PricingError);
  });

  it("acepta margen 99.99 y rechaza valores negativos", () => {
    expect(calculatePricing({ ...base, margen_objetivo_pct: 99.99 }).precio_neto_sugerido).toBeGreaterThan(4000);
    expect(() => calculatePricing({ ...base, merma_pct: -5 })).toThrow(PricingError);
    expect(() => calculatePricing({ ...base, items: [{ cantidad_requerida: -1, costo_unitario: 10 }] })).toThrow(
      PricingError,
    );
  });
});

describe("calculateVolumeTable", () => {
  const rows = calculateVolumeTable(base);

  it("devuelve los 4 tramos con descuentos de margen 0/8/12/15", () => {
    expect(rows.map((r) => r.min_qty)).toEqual([1, 12, 24, 50]);
    expect(rows.map((r) => r.margen_efectivo_pct)).toEqual([50, 42, 38, 35]);
  });

  it("precios por tramo sin IVA", () => {
    expect(rows[0]!.precio_unitario_final).toBe(8000);
    expect(rows[1]!.precio_unitario_final).toBeCloseTo(4000 / 0.58, 2);
    expect(rows[2]!.precio_unitario_final).toBeCloseTo(4000 / 0.62, 2);
    expect(rows[3]!.precio_unitario_final).toBeCloseTo(4000 / 0.65, 2);
  });

  it("precios por tramo con IVA y total por cantidad", () => {
    const withTax = calculateVolumeTable({ ...base, aplica_iva: true });
    expect(withTax[0]!.precio_unitario_final).toBe(9520);
    expect(withTax[1]!.precio_unitario_final).toBeCloseTo((4000 / 0.58) * 1.19, 2);
    expect(withTax[1]!.total_final).toBeCloseTo((4000 / 0.58) * 1.19 * 12, 1);
    expect(withTax[1]!.precio_unitario_neto).toBeCloseTo(4000 / 0.58, 2);
  });

  it("los precios decrecen con el volumen pero nunca bajan del costo total base", () => {
    const costo = calculatePricing(base).costo_total_base;
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.precio_unitario_neto).toBeLessThan(rows[i - 1]!.precio_unitario_neto);
    }
    for (const r of rows) expect(r.precio_unitario_neto).toBeGreaterThanOrEqual(costo);
  });

  it("piso de costo: margen menor al descuento del tramo no vende bajo costo", () => {
    const low = calculateVolumeTable({ ...base, margen_objetivo_pct: 5 });
    expect(low[0]!.limitado_por_costo).toBe(false);
    for (const r of low.slice(1)) {
      expect(r.margen_efectivo_pct).toBe(0);
      expect(r.precio_unitario_neto).toBe(4000);
      expect(r.limitado_por_costo).toBe(true);
    }
  });

  it("margen 0 exacto no se marca como limitado", () => {
    const r = calculateVolumeTable({ ...base, margen_objetivo_pct: 8 });
    expect(r[1]!.margen_efectivo_pct).toBe(0);
    expect(r[1]!.limitado_por_costo).toBe(false);
  });
});

describe("pickTier", () => {
  const rows = calculateVolumeTable(base);
  it.each([
    [1, 1],
    [11, 1],
    [12, 12],
    [23, 12],
    [24, 24],
    [49, 24],
    [50, 50],
    [500, 50],
  ])("qty %i -> tramo %i", (qty, expected) => {
    expect(pickTier(rows, qty)?.min_qty).toBe(expected);
  });
  it("qty 0 no tiene tramo", () => {
    expect(pickTier(rows, 0)).toBeUndefined();
  });
});
