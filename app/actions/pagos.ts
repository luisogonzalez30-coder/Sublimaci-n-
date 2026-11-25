"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { encryptSecret } from "@/lib/crypto";
import { getCountry } from "@/lib/countries";
import { requireWorkspace } from "@/lib/data";
import { getMpUser } from "@/lib/services/mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/validation";

const tokenSchema = z.string().trim().min(20, "Token inválido").max(300).regex(/^[\w-]+$/, "Token inválido");

/** Valida el access token del taller contra GET /users/me y lo guarda CIFRADO (solo servidor). */
export async function guardarTokenMp(input: unknown): Promise<ActionResult<{ nickname?: string }>> {
  const parsed = tokenSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Token inválido" };
  const { workspace } = await requireWorkspace();

  let me;
  try {
    me = await getMpUser(parsed.data);
  } catch {
    return { ok: false, error: "Mercado Pago rechazó el token. Revisa que sea el Access Token de producción." };
  }
  const expected = getCountry(workspace.country_code).mpSite;
  if (me.site_id && me.site_id !== expected) {
    return { ok: false, error: `Esa cuenta de Mercado Pago es de otro país (${me.site_id}); tu taller opera en ${workspace.country_code}.` };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("workspaces").update({ mp_seller_access_token: encryptSecret(parsed.data) }).eq("id", workspace.id);
  if (error) return { ok: false, error: "No se pudo guardar la conexión" };
  revalidatePath("/configuracion/pagos");
  return { ok: true, data: { nickname: me.nickname } };
}

export async function desconectarMp(): Promise<ActionResult> {
  const { workspace } = await requireWorkspace();
  const { error } = await createAdminClient().from("workspaces").update({ mp_seller_access_token: null }).eq("id", workspace.id);
  if (error) return { ok: false, error: "No se pudo desconectar" };
  revalidatePath("/configuracion/pagos");
  return { ok: true };
}
