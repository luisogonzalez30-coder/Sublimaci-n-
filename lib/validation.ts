import { z } from "zod";
import { CATEGORIAS, UNIDADES } from "@/lib/types";

/** Acepta number o string con coma/punto decimal ("1,5"). */
const num = (min: number, max?: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? Number(v.trim().replace(",", ".")) : v),
    max === undefined ? z.number().finite().min(min, `Debe ser >= ${min}`) : z.number().finite().min(min, `Debe ser >= ${min}`).max(max, `Debe ser <= ${max}`),
  );

export const insumoSchema = z.object({
  id: z.uuid().optional(),
  nombre: z.string().trim().min(1, "Ingresa un nombre").max(100),
  categoria: z.enum(CATEGORIAS),
  unidad_medida: z.enum(UNIDADES),
  costo_unitario: num(0, 99_999_999),
  stock_actual: num(0, 99_999_999).default(0),
});
export type InsumoInput = z.input<typeof insumoSchema>;

export const productoSchema = z.object({
  id: z.uuid().optional(),
  nombre: z.string().trim().min(1, "Ingresa un nombre").max(120),
  merma_pct: num(0, 100),
  mano_obra_fija: num(0, 99_999_999),
  gastos_fijos_prorrateo: num(0, 99_999_999),
  margen_objetivo_pct: num(0, 99.99),
  aplica_iva: z.boolean(),
  items: z
    .array(z.object({ insumo_id: z.uuid(), cantidad_requerida: num(0.0001, 99_999_999) }))
    .max(50)
    .refine((items) => new Set(items.map((i) => i.insumo_id)).size === items.length, "Insumo repetido en la receta"),
});
export type ProductoInput = z.input<typeof productoSchema>;

export const workspaceCountrySchema = z.object({
  country_code: z.string().regex(/^[A-Z]{2}$/),
  tax_rate_pct: num(0, 99.99),
});

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
