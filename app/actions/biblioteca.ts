"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data";
import type { ActionResult } from "@/lib/validation";

const MESSAGES: Record<string, string> = {
  BIBLIOTECA_LIMITE_TRIAL: "En la prueba puedes importar 1 pack. Activa tu plan para importar todos los que quieras.",
  BIBLIOTECA_SOLO_PRO: "Este pack es solo para suscriptores.",
  BIBLIOTECA_NO_DISPONIBLE: "Este pack aún no está disponible.",
  TRIAL_VENCIDO: "Tu prueba terminó. Activa tu plan para continuar.",
  WORKSPACE_NO_ENCONTRADO: "Completa el onboarding primero.",
};

export async function importarPlantilla(plantillaId: string): Promise<ActionResult<{ plantilla: string; insumos_creados: number; productos_creados: number }>> {
  if (!/^[0-9a-f-]{36}$/i.test(plantillaId)) return { ok: false, error: "Pack inválido" };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("importar_plantilla", { p_plantilla_id: plantillaId });
  if (error) {
    const key = Object.keys(MESSAGES).find((k) => error.message.includes(k));
    return { ok: false, error: key ? MESSAGES[key]! : "No se pudo importar el pack" };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: data as { plantilla: string; insumos_creados: number; productos_creados: number } };
}
