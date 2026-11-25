"use server";

import { revalidatePath } from "next/cache";
import { getAccessibleWorkspace, getWorkspace } from "@/lib/data";
import { insumoSchema, productoSchema, type ActionResult } from "@/lib/validation";

const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "Datos inválidos";

export async function guardarInsumo(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = insumoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, ...fields } = parsed.data;
  const { supabase, workspace, error: accessError } = await getAccessibleWorkspace();
  if (!workspace) return { ok: false, error: accessError ?? "Sin acceso" };

  const q = id
    ? supabase.from("insumos").update(fields).eq("id", id)
    : supabase.from("insumos").insert({ ...fields, workspace_id: workspace.id });
  const { data, error } = await q.select("id").single<{ id: string }>();
  if (error) return { ok: false, error: "No se pudo guardar el insumo" };
  revalidatePath("/", "layout");
  return { ok: true, data };
}

export async function eliminarInsumo(id: string): Promise<ActionResult> {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from("insumos").delete().eq("id", id);
  if (error) {
    return { ok: false, error: error.code === "23503" ? "Este insumo se usa en uno o más productos. Quítalo de ellos primero." : "No se pudo eliminar" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function guardarProducto(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = productoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { items, ...producto } = parsed.data;
  const { supabase, workspace, error: accessError } = await getAccessibleWorkspace();
  if (!workspace) return { ok: false, error: accessError ?? "Sin acceso" };

  // Una sola transacción en Postgres: producto + receta, o nada.
  const { data, error } = await supabase.rpc("upsert_producto_con_insumos", { p_producto: producto, p_items: items });
  if (error || !data) {
    const msg = error?.message ?? "";
    if (msg.includes("PRODUCTO_NO_ENCONTRADO")) return { ok: false, error: "El producto no existe" };
    if (msg.includes("row-level security") || msg.includes("foreign key")) return { ok: false, error: "Alguno de los insumos no es válido" };
    return { ok: false, error: "No se pudo guardar el producto" };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { id: data as string } };
}

export async function eliminarProducto(id: string): Promise<ActionResult> {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from("productos").delete().eq("id", id);
  if (error) return { ok: false, error: "No se pudo eliminar" };
  revalidatePath("/", "layout");
  return { ok: true };
}
