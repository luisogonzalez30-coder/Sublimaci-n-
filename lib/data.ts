import "server-only";
import { redirect } from "next/navigation";
import { TRIAL_ENDED_MESSAGE, hasActiveAccess } from "@/lib/billing/access";
import { createClient } from "@/lib/supabase/server";
import { WORKSPACE_COLUMNS, type Insumo, type ProductoConReceta, type Workspace } from "@/lib/types";

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function getWorkspace() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("workspaces")
    .select(WORKSPACE_COLUMNS) // nunca select(*): mp_seller_access_token es solo servidor
    .eq("owner_id", user.id)
    .maybeSingle<Workspace>();
  return { supabase, user, workspace: data };
}

/** Para páginas protegidas: si no hay workspace, onboarding. */
export async function requireWorkspace() {
  const ctx = await getWorkspace();
  if (!ctx.workspace) redirect("/onboarding");
  return { ...ctx, workspace: ctx.workspace };
}

export async function listInsumos(): Promise<Insumo[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("insumos").select("*").order("nombre").returns<Insumo[]>();
  return data ?? [];
}

const PRODUCTO_SELECT =
  "*, producto_insumos(id, insumo_id, cantidad_requerida, insumos(id, nombre, costo_unitario, unidad_medida))";

export async function listProductos(): Promise<ProductoConReceta[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("productos").select(PRODUCTO_SELECT).order("nombre").returns<ProductoConReceta[]>();
  return data ?? [];
}

export async function getProducto(id: string): Promise<ProductoConReceta | null> {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("productos").select(PRODUCTO_SELECT).eq("id", id).maybeSingle<ProductoConReceta>();
  return data;
}

/** Para Server Actions: workspace + verificación de trial/suscripción (el guard no es solo de UI). */
export async function getAccessibleWorkspace() {
  const ctx = await getWorkspace();
  if (!ctx.workspace) return { ...ctx, workspace: null, error: "Completa el onboarding primero" as string | null };
  if (!hasActiveAccess(ctx.workspace)) return { ...ctx, workspace: null, error: TRIAL_ENDED_MESSAGE as string | null };
  return { ...ctx, workspace: ctx.workspace, error: null as string | null };
}
