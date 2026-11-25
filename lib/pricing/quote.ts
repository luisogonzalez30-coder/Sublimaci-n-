import { ceilMoney, roundMoney } from "@/lib/money/format";
import { PricingError, calculateVolumeTable, pickTier, type PricingInput } from "@/lib/pricing/calculator";

export interface QuoteLineInput {
  producto_id: string;
  nombre: string;
  cantidad: number;
  pricing: PricingInput;
}

export interface QuoteLine {
  producto_id: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  tramo_min_qty: number;
  limitado_por_costo: boolean;
}

export interface Quote {
  items: QuoteLine[];
  total: number;
  abono_porcentaje: number;
  abono_requerido: number;
  saldo: number;
}

export const DEFAULT_ABONO_PCT = 50;

/**
 * Cotización con precio por volumen (tramo según la cantidad de CADA línea) y abono.
 * Precio unitario redondeado hacia arriba a los decimales de la moneda del workspace.
 */
export function buildQuote(lines: readonly QuoteLineInput[], currency: string, abonoPct: number = DEFAULT_ABONO_PCT): Quote {
  if (!Number.isFinite(abonoPct) || abonoPct <= 0 || abonoPct > 100) {
    throw new PricingError("abono_porcentaje debe estar entre 0 (exclusivo) y 100");
  }
  if (lines.length === 0) throw new PricingError("La cotización necesita al menos un producto");

  const items = lines.map<QuoteLine>((l) => {
    if (!Number.isInteger(l.cantidad) || l.cantidad < 1) throw new PricingError("La cantidad debe ser un entero >= 1");
    const rows = calculateVolumeTable(l.pricing);
    const tier = pickTier(rows, l.cantidad)!;
    const precio_unitario = ceilMoney(tier.precio_unitario_final, currency);
    return {
      producto_id: l.producto_id,
      nombre: l.nombre,
      cantidad: l.cantidad,
      precio_unitario,
      subtotal: roundMoney(precio_unitario * l.cantidad, currency),
      tramo_min_qty: tier.min_qty,
      limitado_por_costo: tier.limitado_por_costo,
    };
  });

  const total = roundMoney(items.reduce((a, i) => a + i.subtotal, 0), currency);
  const abono_requerido = Math.min(total, roundMoney((total * abonoPct) / 100, currency));
  return { items, total, abono_porcentaje: abonoPct, abono_requerido, saldo: roundMoney(total - abono_requerido, currency) };
}
