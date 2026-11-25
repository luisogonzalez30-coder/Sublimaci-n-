"use server";

import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/data";
import { insumoSchema, productoSchema, type ActionResult } from "@/lib/validation";

const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "Datos inválidos";

export async function guardarInsumo(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = insumoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, ...fields } = parsed.data;
  const { supabase, workspace } = await getWorkspace();
  if (!workspace) return { ok: false, error: "Completa el onboarding primero" };

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
  const { id, items, ...fields } = parsed.data;
  const { supabase, workspace } = await getWorkspace();
  if (!workspace) return { ok: false, error: "Completa el onboarding primero" };

  let productoId = id;
  if (id) {
    const { error } = await supabase.from("productos").update(fields).eq("id", id);
    if (error) return { ok: false, error: "No se pudo actualizar el producto" };
    const { error: delErr } = await supabase.from("producto_insumos").delete().eq("producto_id", id);
    if (delErr) return { ok: false, error: "No se pudo actualizar la receta" };
  } else {
    const { data, error } = await supabase
      .from("productos")
      .insert({ ...fields, workspace_id: workspace.id })
      .select("id")
      .single<{ id: string }>();
    if (error || !data) return { ok: false, error: "No se pudo crear el producto" };
    productoId = data.id;
  }

  if (items.length > 0) {
    const { error } = await supabase
      .from("producto_insumos")
      .insert(items.map((i) => ({ ...i, producto_id: productoId! })));
    if (error) {
      if (!id) await supabase.from("productos").delete().eq("id", productoId!); // compensa creación fallida
      return { ok: false, error: "No se pudo guardar la receta (revisa los insumos)" };
    }
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { id: productoId! } };
}

export async function eliminarProducto(id: string): Promise<ActionResult> {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from("productos").delete().eq("id", id);
  if (error) return { ok: false, error: "No se pudo eliminar" };
  revalidatePath("/", "layout");
  return { ok: true };
}
