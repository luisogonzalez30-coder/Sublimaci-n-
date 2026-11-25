"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAccessibleWorkspace } from "@/lib/data";
import { productoToPricingInput } from "@/lib/pricing/adapters";
import { PricingError } from "@/lib/pricing/calculator";
import { buildQuote, DEFAULT_ABONO_PCT } from "@/lib/pricing/quote";
import type { ProductoConReceta } from "@/lib/types";
import { getBaseUrl } from "@/lib/url";
import type { ActionResult } from "@/lib/validation";

const inputSchema = z.object({
  cliente_nombre: z.string().trim().min(1, "Ingresa el nombre del cliente").max(120),
  cliente_whatsapp: z.string().transform((v) => v.replace(/\D/g, "")).pipe(z.string().max(15)),
  plazo_entrega_dias: z.coerce.number().int().min(0).max(365),
  notas_personalizacion: z.string().trim().max(1000).optional(),
  abono_porcentaje: z.coerce.number().gt(0).max(100).default(DEFAULT_ABONO_PCT),
  items: z.array(z.object({ producto_id: z.uuid(), cantidad: z.coerce.number().int().min(1).max(100_000) })).min(1, "Agrega al menos un producto").max(30),
});

export interface CotizacionCreada { id: string; slug: string; url: string; total: number; abono_requerido: number }

/** Los precios SIEMPRE se recalculan en el servidor desde la BD; el cliente solo envía producto y cantidad. */
export async function crearCotizacion(input: unknown): Promise<ActionResult<CotizacionCreada>> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const v = parsed.data;
  const { supabase, workspace, error: accessError } = await getAccessibleWorkspace();
  if (!workspace) return { ok: false, error: accessError ?? "Sin acceso" };

  const { data: productos } = await supabase
    .from("productos")
    .select("*, producto_insumos(id, insumo_id, cantidad_requerida, insumos(id, nombre, costo_unitario, unidad_medida))")
    .in("id", v.items.map((i) => i.producto_id))
    .returns<ProductoConReceta[]>();
  const byId = new Map((productos ?? []).map((p) => [p.id, p]));

  let quote;
  try {
    quote = buildQuote(
      v.items.map((i) => {
        const p = byId.get(i.producto_id);
        if (!p) throw new PricingError("Producto no encontrado");
        return { producto_id: p.id, nombre: p.nombre, cantidad: i.cantidad, pricing: productoToPricingInput(p, workspace) };
      }),
      workspace.currency_code,
      v.abono_porcentaje,
    );
  } catch (e) {
    return { ok: false, error: e instanceof PricingError ? e.message : "No se pudo calcular la cotización" };
  }

  const { data, error } = await supabase
    .from("cotizaciones")
    .insert({
      workspace_id: workspace.id,
      cliente_nombre: v.cliente_nombre,
      cliente_whatsapp: v.cliente_whatsapp,
      items: quote.items,
      total: quote.total,
      abono_porcentaje: quote.abono_porcentaje,
      abono_requerido: quote.abono_requerido,
      plazo_entrega_dias: v.plazo_entrega_dias,
      notas_personalizacion: v.notas_personalizacion || null,
      estado: "enviada",
    })
    .select("id, slug_publico")
    .single<{ id: string; slug_publico: string }>();
  if (error || !data) return { ok: false, error: "No se pudo guardar la cotización" };

  revalidatePath("/cotizar");
  return {
    ok: true,
    data: { id: data.id, slug: data.slug_publico, url: `${await getBaseUrl()}/c/${data.slug_publico}`, total: quote.total, abono_requerido: quote.abono_requerido },
  };
}
