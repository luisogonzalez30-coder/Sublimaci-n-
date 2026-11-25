import { describe, expect, it } from "vitest";
import { PricingError, type PricingInput } from "./calculator";
import { buildQuote } from "./quote";

// base = 4000, margen 50 % ⇒ 8000 neto (ver calculator.test.ts)
const pricing: PricingInput = {
  items: [{ cantidad_requerida: 2, costo_unitario: 1000 }, { cantidad_requerida: 1, costo_unitario: 500 }],
  merma_pct: 10, mano_obra_fija: 1000, gastos_fijos_prorrateo: 250, margen_objetivo_pct: 50, aplica_iva: false, tax_rate_pct: 19,
};
const line = (cantidad: number, p = pricing) => ({ producto_id: "p1", nombre: "Tazón", cantidad, pricing: p });

describe("buildQuote", () => {
  it("1 unidad: precio completo; abono 50 % por defecto", () => {
    const q = buildQuote([line(1)], "CLP");
    expect(q.total).toBe(8000);
    expect(q.abono_porcentaje).toBe(50);
    expect(q.abono_requerido).toBe(4000);
    expect(q.saldo).toBe(4000);
  });

  it("aplica el tramo por volumen de cada línea (12 u. ⇒ margen 42 %)", () => {
    const q = buildQuote([line(12)], "CLP");
    // 4000/0.58 = 6896.55 ⇒ ceil CLP = 6897 ; × 12
    expect(q.items[0]!.precio_unitario).toBe(6897);
    expect(q.items[0]!.tramo_min_qty).toBe(12);
    expect(q.total).toBe(6897 * 12);
    expect(q.abono_requerido).toBe(Math.round((6897 * 12) / 2));
  });

  it("suma varias líneas, con IVA del workspace solo en las que aplican", () => {
    const q = buildQuote([line(1, { ...pricing, aplica_iva: true }), line(1)], "CLP");
    expect(q.items.map((i) => i.subtotal)).toEqual([9520, 8000]);
    expect(q.total).toBe(17520);
    expect(q.abono_requerido).toBe(8760);
  });

  it("respeta los decimales de la moneda (MXN = 2, CLP = 0) y redondea hacia arriba", () => {
    const mx = buildQuote([line(12)], "MXN");
    expect(mx.items[0]!.precio_unitario).toBe(6896.55); // 2 decimales (el calculador ya redondea a centavos)
    const cl = buildQuote([line(12)], "CLP");
    expect(Number.isInteger(cl.total)).toBe(true);
  });

  it("nunca vende bajo el costo base por unidad", () => {
    for (const qty of [1, 12, 24, 50, 500]) {
      const q = buildQuote([line(qty)], "CLP");
      expect(q.items[0]!.precio_unitario).toBeGreaterThanOrEqual(4000);
    }
  });

  it.each([[0], [-5], [101], [Number.NaN]])("abono inválido %s", (pct) => {
    expect(() => buildQuote([line(1)], "CLP", pct)).toThrow(PricingError);
  });

  it("abono 100 % ⇒ abono = total; abono 30 % configurable", () => {
    expect(buildQuote([line(1)], "CLP", 100).abono_requerido).toBe(8000);
    expect(buildQuote([line(1)], "CLP", 30).abono_requerido).toBe(2400);
  });

  it("rechaza cotización vacía y cantidades no enteras o < 1", () => {
    expect(() => buildQuote([], "CLP")).toThrow(PricingError);
    expect(() => buildQuote([line(0)], "CLP")).toThrow(PricingError);
    expect(() => buildQuote([line(1.5)], "CLP")).toThrow(PricingError);
  });

  it("abono + saldo = total siempre", () => {
    for (const pct of [33.33, 50, 66.67]) {
      const q = buildQuote([line(7)], "MXN", pct);
      expect(Math.round((q.abono_requerido + q.saldo) * 100) / 100).toBe(q.total);
    }
  });
});
