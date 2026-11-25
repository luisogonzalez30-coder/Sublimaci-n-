import type { PricingInput } from "@/lib/pricing/calculator";
import type { Producto, ProductoConReceta, Workspace } from "@/lib/types";

export function toPricingInput(
  p: Pick<Producto, "merma_pct" | "mano_obra_fija" | "gastos_fijos_prorrateo" | "margen_objetivo_pct" | "aplica_iva">,
  items: PricingInput["items"],
  ws: Pick<Workspace, "tax_rate_pct">,
): PricingInput {
  return {
    items,
    merma_pct: Number(p.merma_pct),
    mano_obra_fija: Number(p.mano_obra_fija),
    gastos_fijos_prorrateo: Number(p.gastos_fijos_prorrateo),
    margen_objetivo_pct: Number(p.margen_objetivo_pct),
    aplica_iva: p.aplica_iva,
    tax_rate_pct: Number(ws.tax_rate_pct),
  };
}

export function productoToPricingInput(p: ProductoConReceta, ws: Pick<Workspace, "tax_rate_pct">): PricingInput {
  return toPricingInput(
    p,
    p.producto_insumos.map((pi) => ({
      cantidad_requerida: Number(pi.cantidad_requerida),
      costo_unitario: Number(pi.insumos?.costo_unitario ?? 0),
    })),
    ws,
  );
}
