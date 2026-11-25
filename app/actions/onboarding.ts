"use server";

import { revalidatePath } from "next/cache";
import { getCountry } from "@/lib/countries";
import { getWorkspace, requireUser } from "@/lib/data";
import type { Insumo } from "@/lib/types";
import { insumoSchema, workspaceCountrySchema, type ActionResult } from "@/lib/validation";

/** Paso 1: crea (o actualiza) el workspace con país, moneda e impuesto local. */
export async function guardarPais(input: unknown): Promise<ActionResult> {
  const parsed = workspaceCountrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const country = getCountry(parsed.data.country_code);
  if (country.code !== parsed.data.country_code) return { ok: false, error: "País no soportado" };

  const { supabase, user } = await requireUser();
  const geo = { country_code: country.code, currency_code: country.currency, tax_rate_pct: parsed.data.tax_rate_pct };

  const { workspace } = await getWorkspace();
  if (workspace) {
    const { error } = await supabase.from("workspaces").update(geo).eq("id", workspace.id);
    if (error) return { ok: false, error: "No se pudo guardar" };
  } else {
    const meta = user.user_metadata as { nombre_taller?: string; whatsapp?: string };
    const { error } = await supabase.from("workspaces").insert({
      owner_id: user.id,
      nombre_taller: meta.nombre_taller?.trim() || "Mi taller",
      whatsapp: meta.whatsapp ?? "",
      ...geo,
    });
    if (error) return { ok: false, error: "No se pudo crear tu taller" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Paso 2: carga rápida de insumos iniciales. Devuelve las filas creadas. */
export async function crearInsumosIniciales(input: unknown): Promise<ActionResult<Insumo[]>> {
  const list = Array.isArray(input) ? input : [];
  if (list.length === 0 || list.length > 10) return { ok: false, error: "Agrega al menos un insumo" };
  const rows = [];
  for (const raw of list) {
    const parsed = insumoSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    rows.push(parsed.data);
  }
  const { supabase, workspace } = await getWorkspace();
  if (!workspace) return { ok: false, error: "Falta el paso 1" };

  const { data, error } = await supabase
    .from("insumos")
    .insert(rows.map(({ id: _id, ...r }) => ({ ...r, workspace_id: workspace.id })))
    .select("*")
    .returns<Insumo[]>();
  if (error || !data) return { ok: false, error: "No se pudieron guardar los insumos" };
  revalidatePath("/", "layout");
  return { ok: true, data };
}
