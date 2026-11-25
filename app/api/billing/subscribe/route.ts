import { NextResponse } from "next/server";
import { buildPreapprovalBody } from "@/lib/billing/plans";
import { getWorkspace } from "@/lib/data";
import { createPreapproval } from "@/lib/services/mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBaseUrl } from "@/lib/url";

/** Crea la suscripción mensual en Mercado Pago (cobro inmediato, SIN free_trial). */
export async function POST() {
  const token = process.env.MP_PLATFORM_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ error: "Pagos de suscripción no configurados" }, { status: 503 });

  const { user, workspace } = await getWorkspace();
  if (!workspace || !user.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (workspace.subscription_status === "active") return NextResponse.json({ error: "Ya tienes un plan activo" }, { status: 409 });

  try {
    const pre = await createPreapproval(
      token,
      buildPreapprovalBody({ workspaceId: workspace.id, payerEmail: user.email, countryCode: workspace.country_code, baseUrl: await getBaseUrl() }),
    );
    if (!pre.init_point) throw new Error("sin init_point");
    await createAdminClient().from("workspaces").update({ mp_preapproval_id: pre.id }).eq("id", workspace.id);
    return NextResponse.json({ init_point: pre.init_point });
  } catch {
    return NextResponse.json({ error: "No se pudo iniciar la suscripción. Escríbenos por WhatsApp." }, { status: 502 });
  }
}
